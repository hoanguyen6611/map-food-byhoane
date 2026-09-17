import { ConfigService } from '@nestjs/config';
import { ClaudeGatewayService } from './claude-gateway.service';

const createMock = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

function textResponse(payload: unknown, stopReason = 'end_turn') {
  return {
    stop_reason: stopReason,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

function buildService(
  prismaOverrides: Record<string, unknown> = {},
  apiKey = 'test-key',
) {
  const config = new ConfigService({
    ANTHROPIC_API_KEY: apiKey,
    AI_MODERATION_MODEL: 'claude-haiku-4-5',
    AI_MODERATION_TIMEOUT_MS: '8000',
    AI_SUMMARY_MODEL: 'claude-opus-5',
  });
  const prisma = {
    restaurant: { findUniqueOrThrow: jest.fn() },
    review: { findMany: jest.fn() },
    ...prismaOverrides,
  } as never;
  return new ClaudeGatewayService(config, prisma);
}

describe('ClaudeGatewayService.moderate', () => {
  beforeEach(() => createMock.mockReset());

  it('returns auto_approve for low-risk content, derived from riskScore (not trusted from Claude directly)', async () => {
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 0.1,
        labels: [],
        reason: 'Nội dung bình thường.',
        isSevereViolation: false,
      }),
    );
    const service = buildService();
    const result = await service.moderate({ text: 'Quán ngon, phục vụ tốt.' });
    expect(result.recommendedAction).toBe('auto_approve');
    expect(result.riskScore).toBe(0.1);
  });

  it('returns hold_for_review when riskScore crosses the medium threshold', async () => {
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 0.6,
        labels: ['spam'],
        reason: 'Nghi ngờ spam.',
        isSevereViolation: false,
      }),
    );
    const service = buildService();
    const result = await service.moderate({ text: 'Xem thêm tại link này...' });
    expect(result.recommendedAction).toBe('hold_for_review');
  });

  it('forces reject when Claude flags isSevereViolation, regardless of riskScore', async () => {
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 0.95,
        labels: ['hate_speech'],
        reason: 'Ngôn từ thù ghét.',
        isSevereViolation: true,
      }),
    );
    const service = buildService();
    const result = await service.moderate({ text: 'nội dung vi phạm' });
    expect(result.recommendedAction).toBe('reject');
  });

  it('clamps an out-of-range riskScore into [0,1]', async () => {
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 1.4,
        labels: [],
        reason: 'x',
        isSevereViolation: false,
      }),
    );
    const service = buildService();
    const result = await service.moderate({ text: 'x' });
    expect(result.riskScore).toBe(1);
  });

  it('throws on a refusal stop_reason instead of trusting empty content', async () => {
    createMock.mockResolvedValue(textResponse({}, 'refusal'));
    const service = buildService();
    await expect(service.moderate({ text: 'x' })).rejects.toThrow();
  });

  it('throws when the underlying API call throws (network/timeout)', async () => {
    createMock.mockRejectedValue(new Error('timeout'));
    const service = buildService();
    await expect(service.moderate({ text: 'x' })).rejects.toThrow('timeout');
  });

  it('short-circuits with auto_approve and no Claude call for empty/null text', async () => {
    const service = buildService();
    const result = await service.moderate({ text: null });
    expect(result.recommendedAction).toBe('auto_approve');
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('ClaudeGatewayService.moderate — free rule-based fallback (no ANTHROPIC_API_KEY)', () => {
  beforeEach(() => createMock.mockReset());

  it('never calls the Claude API when no key is configured', async () => {
    const service = buildService({}, '');
    await service.moderate({ text: 'Quán ngon, phục vụ tốt.' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('auto-approves clean text via the rule-based heuristic', async () => {
    const service = buildService({}, '');
    const result = await service.moderate({ text: 'Quán ngon, phục vụ tốt.' });
    expect(result.recommendedAction).toBe('auto_approve');
    expect(result.aiReason).toContain('rule-based');
  });

  it('holds spammy text for review via the rule-based heuristic, and never returns reject (no severity judgment available)', async () => {
    const service = buildService({}, '');
    const result = await service.moderate({
      text: 'kiếm tiền online dễ dàng, xem tại https://spam.example.com nhé',
    });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toEqual(
      expect.arrayContaining(['contains_url', 'spam_phrase']),
    );
  });
});

describe('ClaudeGatewayService.moderate — image input', () => {
  const originalFetch = global.fetch;

  beforeEach(() => createMock.mockReset());
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('holds for review without calling Claude when no API key is configured', async () => {
    const service = buildService({}, '');
    const result = await service.moderate({
      text: null,
      imageUrls: ['https://example.com/photo.jpg'],
    });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toContain('image_unscreened_no_api_key');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('fetches the image, sends it as a base64 vision block, and derives the result from Claude', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () =>
        new TextEncoder().encode('fake-image-bytes').buffer,
    }) as never;
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 0.1,
        labels: [],
        reason: 'Ảnh món ăn bình thường.',
        isSevereViolation: false,
      }),
    );

    const service = buildService();
    const result = await service.moderate({
      text: null,
      imageUrls: ['https://storage.example.com/photo.jpg'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://storage.example.com/photo.jpg',
    );
    expect(result.recommendedAction).toBe('auto_approve');
    const callArgs = createMock.mock.calls[0][0];
    const imageBlock = callArgs.messages[0].content.find(
      (block: { type: string }) => block.type === 'image',
    );
    expect(imageBlock).toBeDefined();
    expect(imageBlock.source.type).toBe('base64');
    expect(imageBlock.source.media_type).toBe('image/jpeg');
  });

  it('skips a failed image fetch and still moderates using any remaining text', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as never;
    createMock.mockResolvedValue(
      textResponse({
        riskScore: 0.1,
        labels: [],
        reason: 'Nội dung bình thường.',
        isSevereViolation: false,
      }),
    );

    const service = buildService();
    const result = await service.moderate({
      text: 'Quán ngon',
      imageUrls: ['https://storage.example.com/broken.jpg'],
    });

    expect(result.recommendedAction).toBe('auto_approve');
    const callArgs = createMock.mock.calls[0][0];
    expect(
      callArgs.messages[0].content.some(
        (block: { type: string }) => block.type === 'image',
      ),
    ).toBe(false);
  });

  it('throws if every image fetch fails and there is no text either', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as never;
    const service = buildService();
    await expect(
      service.moderate({
        text: null,
        imageUrls: ['https://storage.example.com/broken.jpg'],
      }),
    ).rejects.toThrow();
  });
});

describe('ClaudeGatewayService.summarize', () => {
  beforeEach(() => createMock.mockReset());

  it('returns the parsed summary shape', async () => {
    createMock.mockResolvedValue(
      textResponse({
        summaryText: 'Quán được yêu thích.',
        pros: ['Ngon'],
        cons: ['Đông khách'],
      }),
    );
    const prisma = {
      restaurant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Quán Test' }),
      },
      review: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ comment: 'Rất ngon', overallRating: 5 }]),
      },
    };
    const service = buildService(prisma);
    const result = await service.summarize('restaurant-1');
    expect(result).toEqual({
      summaryText: 'Quán được yêu thích.',
      pros: ['Ngon'],
      cons: ['Đông khách'],
    });
  });

  it('throws on refusal', async () => {
    createMock.mockResolvedValue(textResponse({}, 'refusal'));
    const prisma = {
      restaurant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Quán Test' }),
      },
      review: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ comment: 'Rất ngon', overallRating: 5 }]),
      },
    };
    const service = buildService(prisma);
    await expect(service.summarize('restaurant-1')).rejects.toThrow();
  });
});
