import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import {
  recommendActionForRiskScore,
  scoreTextContentRuleBased,
} from '../moderation/rule-based-moderation.util';
import type {
  AIGateway,
  AISummaryResult,
  ModerateContentInput,
  StructuredFilter,
} from './ai-gateway.interface';
import type { ModerationCheckResult } from '../review/review-moderation.service';

const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    riskScore: {
      type: 'number',
      description: '0.0 (hoàn toàn an toàn) đến 1.0 (vi phạm nghiêm trọng).',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Nhãn ngắn cho từng dấu hiệu phát hiện được, ví dụ: spam, quang_cao, ngon_ngu_thu_dich, thong_tin_ca_nhan, noi_dung_khong_lien_quan.',
    },
    reason: {
      type: 'string',
      description:
        '1-2 câu tiếng Việt giải thích lý do, hiển thị cho người kiểm duyệt.',
    },
    isSevereViolation: {
      type: 'boolean',
      description:
        'true CHỈ khi nội dung vi phạm nghiêm trọng rõ ràng (thù ghét, quấy rối, nội dung bất hợp pháp) và nên bị từ chối thẳng thay vì chỉ giữ lại để xem xét.',
    },
  },
  required: ['riskScore', 'labels', 'reason', 'isSevereViolation'],
  additionalProperties: false,
} as const;

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summaryText: {
      type: 'string',
      description:
        'Một đoạn văn tiếng Việt tóm tắt trung thực cảm nhận chung của thực khách.',
    },
    pros: {
      type: 'array',
      items: { type: 'string' },
      description:
        '3-5 điểm tích cực ngắn gọn, chỉ dựa trên nội dung đánh giá thật.',
    },
    cons: {
      type: 'array',
      items: { type: 'string' },
      description:
        '0-5 điểm hạn chế ngắn gọn, chỉ dựa trên nội dung đánh giá thật (mảng rỗng nếu không có).',
    },
  },
  required: ['summaryText', 'pros', 'cons'],
  additionalProperties: false,
} as const;

const MAX_REVIEWS_FOR_SUMMARY = 50;

/**
 * Real Claude adapter for `AIGateway` (docs/05-system-architecture.md §4).
 * `moderate()` uses Haiku 4.5 (fast/cheap — called synchronously on every
 * review/contribution submission); `summarize()` uses Opus 5 (called rarely,
 * in the background, from CompositeScoreService.recompute() via
 * AiSummaryService — favors quality over latency).
 *
 * `moderate()` has a free, zero-network fallback: when no
 * `ANTHROPIC_API_KEY` is configured, it runs the rule-based heuristic
 * (`scoreTextContentRuleBased`, same URL/spam-phrase/all-caps/repeated-char
 * patterns this project used before the real adapter existed) instead of
 * ever attempting a Claude call — so the moderation pipeline works with
 * zero cost/setup, and automatically switches to real Claude the moment a
 * key is added, with no code changes needed on either side. `summarize()`
 * has NO free fallback by design — generating a believable AI Summary
 * without an LLM would mean fabricating content, which violates this
 * project's "never fabricate" rule; with no key it simply throws, and
 * AiSummaryService's own fail-safe leaves the restaurant in its honest
 * "no summary yet" empty state instead.
 *
 * `parseQuery()` is intentionally not implemented — no callers exist
 * anywhere in the app (see ai-gateway.interface.ts).
 */
@Injectable()
export class ClaudeGatewayService implements AIGateway {
  private readonly logger = new Logger(ClaudeGatewayService.name);
  private readonly client: Anthropic;
  private readonly hasApiKey: boolean;
  private readonly moderationModel: string;
  private readonly moderationTimeoutMs: number;
  private readonly summaryModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.hasApiKey = Boolean(apiKey);
    this.client = new Anthropic({ apiKey });
    this.moderationModel = this.config.get<string>(
      'AI_MODERATION_MODEL',
      'claude-haiku-4-5',
    );
    this.moderationTimeoutMs = Number(
      this.config.get<string>('AI_MODERATION_TIMEOUT_MS', '8000'),
    );
    this.summaryModel = this.config.get<string>(
      'AI_SUMMARY_MODEL',
      'claude-opus-5',
    );
    if (!this.hasApiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set — moderate() will use the free rule-based fallback instead of Claude.',
      );
    }
  }

  /**
   * `recommendedAction` is derived here via `recommendActionForRiskScore()`
   * — the same threshold constant the hard rule (moderation-decision.util.ts)
   * uses — rather than trusted directly from Claude, so the
   * auto_approve/hold_for_review boundary can never drift from the hard
   * rule's own math. Claude only contributes `isSevereViolation`, which
   * forces `'reject'` for clear-cut egregious content (the rule-based
   * fallback below never produces 'reject' — it has no way to judge
   * severity, only pattern-match).
   *
   * Images (`content.imageUrls`) are fetched and sent as base64 vision
   * input, not passed as a `type: 'url'` source — Anthropic's servers can't
   * be assumed to reach an internal/LAN-only storage endpoint (same
   * internal-vs-public reachability concern as S3Service's presignClient),
   * so fetching the bytes ourselves (the backend already has network access
   * to its own storage) works identically in local dev and production. A
   * URL that fails to fetch is logged and skipped rather than failing the
   * whole call — one bad photo shouldn't block moderation of the rest.
   */
  async moderate(
    content: ModerateContentInput,
  ): Promise<ModerationCheckResult> {
    const text = content.text?.trim() || null;
    const imageUrls = content.imageUrls?.filter(Boolean) ?? [];
    if (!text && imageUrls.length === 0) {
      return {
        riskScore: 0,
        labels: [],
        aiReason: 'Không có nội dung để kiểm duyệt.',
        recommendedAction: 'auto_approve',
      };
    }

    if (!this.hasApiKey) {
      if (imageUrls.length > 0) {
        // The rule-based fallback can only pattern-match TEXT — it has no
        // way to screen pixel content, so an unscreenable image is held for
        // manual review rather than silently waved through (same fail-safe
        // philosophy as a Claude outage, just triggered by missing config
        // instead of a network error).
        return {
          riskScore: 0.5,
          labels: ['image_unscreened_no_api_key'],
          aiReason:
            'Chưa cấu hình Claude API — không thể tự động kiểm tra nội dung ảnh, cần người kiểm duyệt xem xét.',
          recommendedAction: 'hold_for_review',
        };
      }
      const { riskScore, labels, reason } = scoreTextContentRuleBased(text);
      return {
        riskScore,
        labels,
        aiReason: reason,
        recommendedAction: recommendActionForRiskScore(riskScore),
      };
    }

    const imageBlocks = await this.fetchImageBlocks(imageUrls);
    const contentBlocks: Array<
      Anthropic.TextBlockParam | Anthropic.ImageBlockParam
    > = [];
    if (text) contentBlocks.push({ type: 'text', text });
    contentBlocks.push(...imageBlocks);
    if (contentBlocks.length === 0) {
      throw new Error(
        'Không thể tải ảnh để kiểm duyệt và không có nội dung văn bản đi kèm.',
      );
    }

    const response = await this.client.messages.create(
      {
        model: this.moderationModel,
        max_tokens: 1024,
        system:
          'Bạn là bộ lọc kiểm duyệt nội dung cho một nền tảng đánh giá quán ăn Việt Nam (đánh giá, đề xuất quán mới, báo cáo cập nhật, ảnh đính kèm). ' +
          'Nhiệm vụ: chấm điểm rủi ro cho nội dung do người dùng gửi — phát hiện spam, quảng cáo trá hình, link độc hại, ngôn ngữ thù ghét/quấy rối, thông tin cá nhân, nội dung hoàn toàn không liên quan đến quán ăn. ' +
          (imageBlocks.length > 0
            ? 'Nếu có ảnh đính kèm, hãy đánh giá luôn nội dung ảnh: ảnh phản cảm/bạo lực/khiêu dâm, ảnh không liên quan gì tới quán ăn/đồ ăn, ảnh chỉ chứa quảng cáo hoặc số điện thoại, ảnh mờ/đen hoàn toàn (spam). '
            : '') +
          'Không tự chế ra vi phạm không có thật. Nội dung bình thường (khen/chê quán ăn thật, ảnh món ăn/không gian quán thật) phải có riskScore thấp.',
        messages: [{ role: 'user', content: contentBlocks }],
        output_config: {
          format: { type: 'json_schema', schema: MODERATION_SCHEMA },
        },
      },
      { timeout: this.moderationTimeoutMs },
    );

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude từ chối kiểm duyệt nội dung này (refusal).');
    }
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('Claude không trả về nội dung kiểm duyệt hợp lệ.');
    }

    const parsed = JSON.parse(textBlock.text) as {
      riskScore: number;
      labels: string[];
      reason: string;
      isSevereViolation: boolean;
    };
    const riskScore = Math.min(1, Math.max(0, parsed.riskScore));
    const recommendedAction = parsed.isSevereViolation
      ? 'reject'
      : recommendActionForRiskScore(riskScore);

    return {
      riskScore,
      labels: parsed.labels,
      aiReason: parsed.reason,
      recommendedAction,
    };
  }

  /** Fetches each URL and base64-encodes it for Claude vision input; a failed fetch is logged and skipped, not thrown. */
  private async fetchImageBlocks(
    urls: string[],
  ): Promise<Anthropic.ImageBlockParam[]> {
    const results = await Promise.all(
      urls.map(async (url): Promise<Anthropic.ImageBlockParam | null> => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const mediaType = this.imageMediaTypeFromContentType(
            response.headers.get('content-type'),
          );
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          };
        } catch (error) {
          this.logger.warn(
            `Failed to fetch image for moderation (${url}): ${String(error)}`,
          );
          return null;
        }
      }),
    );
    return results.filter(
      (block): block is Anthropic.ImageBlockParam => block !== null,
    );
  }

  private imageMediaTypeFromContentType(
    contentType: string | null,
  ): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    switch (contentType) {
      case 'image/png':
        return 'image/png';
      case 'image/gif':
        return 'image/gif';
      case 'image/webp':
        return 'image/webp';
      default:
        // MediaService.confirm() always re-encodes to image/jpeg before
        // storing, so this is the correct default even when a proxy/CDN
        // strips or mangles the content-type header.
        return 'image/jpeg';
    }
  }

  async summarize(restaurantId: string): Promise<AISummaryResult> {
    const [restaurant, reviews] = await Promise.all([
      this.prisma.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        select: { name: true },
      }),
      this.prisma.review.findMany({
        where: {
          restaurantId,
          status: 'published',
          deletedAt: null,
          comment: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_REVIEWS_FOR_SUMMARY,
        select: { comment: true, overallRating: true },
      }),
    ]);

    const reviewsText = reviews
      .map((r, i) => `${i + 1}. (${r.overallRating}/5 sao) ${r.comment}`)
      .join('\n');

    const response = await this.client.messages.create({
      model: this.summaryModel,
      max_tokens: 4096,
      system:
        'Bạn viết tóm tắt trung thực các đánh giá thực khách cho một quán ăn Việt Nam. ' +
        'Chỉ dựa trên nội dung đánh giá được cung cấp — không bịa thêm chi tiết không có trong đánh giá. ' +
        'Nếu các đánh giá mâu thuẫn nhau, phản ánh điều đó một cách cân bằng thay vì chỉ chọn một phía.',
      messages: [
        {
          role: 'user',
          content: `Quán: ${restaurant.name}\n\nCác đánh giá (mới nhất trước):\n${reviewsText}`,
        },
      ],
      output_config: {
        format: { type: 'json_schema', schema: SUMMARY_SCHEMA },
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude từ chối tạo tóm tắt cho quán này (refusal).');
    }
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      throw new Error('Claude không trả về tóm tắt hợp lệ.');
    }

    const parsed = JSON.parse(textBlock.text) as {
      summaryText: string;
      pros: string[];
      cons: string[];
    };
    return {
      summaryText: parsed.summaryText,
      pros: parsed.pros,
      cons: parsed.cons,
    };
  }

  parseQuery(
    _text: string,
    _context?: Record<string, unknown>,
  ): Promise<StructuredFilter> {
    throw new NotImplementedException(
      'AIGateway.parseQuery() has no callers anywhere in the app yet — not implemented.',
    );
  }
}
