import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTING_KEYS,
  type AboutContent,
  type FooterSettings,
  type GamificationSettings,
  type ScoringSettings,
  type SiteSettingKey,
  type SiteSettingsDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;
const MAX_TEXT = 5000;
const MAX_URL = 500;

/** ICU placeholders the About page fills in — an edit must keep them. */
const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
  'levels.levelLabel': ['{level}'],
  'levels.levelThreshold': ['{points}'],
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function int(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestException(`${field} phải là số nguyên từ ${min} đến ${max}`);
  }
  return n;
}

function link(value: unknown, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new BadRequestException(`${field} không hợp lệ`);
  const v = value.trim();
  if (v === '') return '';
  if (v.length > MAX_URL) throw new BadRequestException(`${field} quá dài`);
  const ok = /^https?:\/\/\S+$/i.test(v) || /^mailto:\S+@\S+$/i.test(v) || (/^\/(?!\/)\S*$/.test(v));
  if (!ok) throw new BadRequestException(`${field}: dùng link https://…, mailto:… hoặc đường dẫn nội bộ /…`);
  return v;
}

/**
 * Admin-editable settings (footer links, scoring/gamification rules, About
 * page copy). Values are validated and normalised here — the only writer —
 * and read through a short in-process cache, so the hot paths that depend on
 * them (composite score recompute, gamification, every web render) don't
 * hit the table each time. Multi-instance deployments converge within
 * CACHE_TTL_MS of a save.
 */
@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);
  private cache: { value: SiteSettingsDto; expires: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<SiteSettingsDto> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.value;
    let rows: { key: string; value: Prisma.JsonValue }[] = [];
    try {
      rows = await this.prisma.siteSetting.findMany();
    } catch (error) {
      // Table not migrated yet / DB hiccup: keep serving defaults rather than
      // breaking scoring and every page that reads settings.
      this.logger.warn(`Falling back to default site settings: ${(error as Error).message}`);
    }
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const value: SiteSettingsDto = {
      footer: this.safe(() => this.normalizeFooter(stored.get('footer')), DEFAULT_SITE_SETTINGS.footer),
      scoring: this.safe(() => this.normalizeScoring(stored.get('scoring')), DEFAULT_SITE_SETTINGS.scoring),
      gamification: this.safe(() => this.normalizeGamification(stored.get('gamification')), DEFAULT_SITE_SETTINGS.gamification),
      about: this.safe(() => this.normalizeAbout(stored.get('about')), DEFAULT_SITE_SETTINGS.about),
    };
    this.cache = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async get<K extends SiteSettingKey>(key: K): Promise<SiteSettingsDto[K]> {
    return (await this.getAll())[key];
  }

  /** Validates, stores and returns the normalised value. Throws 400 on invalid input. */
  async update<K extends SiteSettingKey>(key: K, raw: unknown, actorId: string): Promise<SiteSettingsDto[K]> {
    if (!SITE_SETTING_KEYS.includes(key)) throw new BadRequestException('Cài đặt không tồn tại');
    if (raw === undefined || raw === null) throw new BadRequestException('Thiếu dữ liệu');
    const value = this.normalize(key, raw, true) as SiteSettingsDto[K];
    await this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId },
      create: { key, value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId },
    });
    this.cache = null;
    return value;
  }

  private normalize(key: SiteSettingKey, raw: unknown, strict: boolean): unknown {
    switch (key) {
      case 'footer':
        return this.normalizeFooter(raw);
      case 'scoring':
        return this.normalizeScoring(raw);
      case 'gamification':
        return this.normalizeGamification(raw);
      case 'about':
        return this.normalizeAbout(raw, strict);
    }
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (error) {
      this.logger.warn(`Ignoring invalid stored site setting: ${(error as Error).message}`);
      return fallback;
    }
  }

  private normalizeFooter(raw: unknown): FooterSettings {
    const d = DEFAULT_SITE_SETTINGS.footer;
    if (raw === undefined) return d;
    if (!isObject(raw)) throw new BadRequestException('Cài đặt footer không hợp lệ');
    const social = isObject(raw.social) ? raw.social : {};
    const links = isObject(raw.links) ? raw.links : {};
    return {
      social: {
        facebook: link(social.facebook, 'Facebook'),
        instagram: link(social.instagram, 'Instagram'),
        tiktok: link(social.tiktok, 'TikTok'),
      },
      links: {
        contact: link(links.contact, 'Liên hệ'),
        terms: link(links.terms, 'Điều khoản'),
        privacy: link(links.privacy, 'Quyền riêng tư'),
        communityGuidelines: link(links.communityGuidelines, 'Quy tắc cộng đồng'),
      },
    };
  }

  private normalizeScoring(raw: unknown): ScoringSettings {
    if (raw === undefined) return DEFAULT_SITE_SETTINGS.scoring;
    if (!isObject(raw)) throw new BadRequestException('Cài đặt chấm điểm không hợp lệ');
    return { minVotesThreshold: int(raw.minVotesThreshold, 'Số đánh giá để điểm ổn định', 1, 100) };
  }

  private normalizeGamification(raw: unknown): GamificationSettings {
    const d = DEFAULT_SITE_SETTINGS.gamification;
    if (raw === undefined) return d;
    if (!isObject(raw)) throw new BadRequestException('Cài đặt cấp độ không hợp lệ');
    const thresholdsRaw = raw.levelThresholds;
    if (!Array.isArray(thresholdsRaw) || thresholdsRaw.length !== d.levelThresholds.length) {
      throw new BadRequestException(`Cần đúng ${d.levelThresholds.length} mốc lên cấp`);
    }
    const levelThresholds = thresholdsRaw.map((v, i) => int(v, `Mốc cấp ${i + 1}`, 0, 10_000_000));
    if (levelThresholds[0] !== 0) throw new BadRequestException('Cấp 1 phải bắt đầu từ 0 điểm');
    for (let i = 1; i < levelThresholds.length; i++) {
      if (levelThresholds[i] <= levelThresholds[i - 1]) {
        throw new BadRequestException(`Mốc cấp ${i + 1} phải lớn hơn mốc cấp ${i}`);
      }
    }
    const badges = isObject(raw.badgeThresholds) ? raw.badgeThresholds : {};
    return {
      pointsPerReview: int(raw.pointsPerReview, 'Điểm mỗi đánh giá', 0, 1000),
      pointsPerContribution: int(raw.pointsPerContribution, 'Điểm mỗi quán đóng góp', 0, 1000),
      pointsPerHelpfulVote: int(raw.pointsPerHelpfulVote, 'Điểm mỗi lượt hữu ích', 0, 1000),
      levelThresholds,
      badgeThresholds: {
        contributor_10: int(badges.contributor_10 ?? d.badgeThresholds.contributor_10, 'Huy hiệu đóng góp quán', 1, 100_000),
        coffee_hunter: int(badges.coffee_hunter ?? d.badgeThresholds.coffee_hunter, 'Huy hiệu thợ săn cà phê', 1, 100_000),
        helpful_100: int(badges.helpful_100 ?? d.badgeThresholds.helpful_100, 'Huy hiệu lượt hữu ích', 1, 100_000),
      },
    };
  }

  /**
   * Keeps exactly the default content's shape: unknown keys dropped, blank
   * strings fall back to the default text, long text rejected (strict) or
   * cut (when reading back old rows).
   */
  private normalizeAbout(raw: unknown, strict = false): { vi: AboutContent; en: AboutContent } {
    const d = DEFAULT_SITE_SETTINGS.about;
    if (raw === undefined) return d;
    if (!isObject(raw)) throw new BadRequestException('Nội dung trang Giới thiệu không hợp lệ');
    const merge = (def: unknown, val: unknown, path: string, locale: string): unknown => {
      if (typeof def === 'string') {
        if (typeof val !== 'string' || val.trim() === '') return def;
        let text = val.trim();
        if (text.length > MAX_TEXT) {
          if (strict) throw new BadRequestException(`Nội dung "${path}" (${locale}) quá dài`);
          text = text.slice(0, MAX_TEXT);
        }
        for (const ph of REQUIRED_PLACEHOLDERS[path] ?? []) {
          if (!text.includes(ph)) {
            if (strict) throw new BadRequestException(`Nội dung "${path}" (${locale}) phải giữ ${ph}`);
            return def;
          }
        }
        return text;
      }
      const out: Record<string, unknown> = {};
      const src = isObject(val) ? val : {};
      for (const [k, sub] of Object.entries(def as Record<string, unknown>)) {
        out[k] = merge(sub, src[k], path ? `${path}.${k}` : k, locale);
      }
      return out;
    };
    return {
      vi: merge(d.vi, raw.vi, '', 'vi') as AboutContent,
      en: merge(d.en, raw.en, '', 'en') as AboutContent,
    };
  }
}
