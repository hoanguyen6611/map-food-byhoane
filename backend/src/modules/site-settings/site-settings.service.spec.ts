import { BadRequestException } from '@nestjs/common';
import { DEFAULT_SITE_SETTINGS } from '@foodmap/shared-types';
import { SiteSettingsService } from './site-settings.service';

function make(rows: { key: string; value: unknown }[] = [], fail = false) {
  const prisma = {
    siteSetting: {
      findMany: jest.fn(() => (fail ? Promise.reject(new Error('relation "site_settings" does not exist')) : Promise.resolve(rows))),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new SiteSettingsService(prisma as any), prisma };
}

describe('SiteSettingsService', () => {
  it('serves defaults when nothing is stored or the table is missing', async () => {
    expect(await make().service.getAll()).toEqual(DEFAULT_SITE_SETTINGS);
    expect(await make([], true).service.getAll()).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('accepts valid gamification rules and stores the normalised value', async () => {
    const { service, prisma } = make();
    const value = await service.update(
      'gamification',
      { pointsPerReview: '12', pointsPerContribution: 20, pointsPerHelpfulVote: 1, levelThresholds: [0, 50, 150, 400, 900] },
      'admin-1',
    );
    expect(value.pointsPerReview).toBe(12);
    expect(value.badgeThresholds).toEqual(DEFAULT_SITE_SETTINGS.gamification.badgeThresholds);
    expect(prisma.siteSetting.upsert).toHaveBeenCalled();
  });

  it('rejects level thresholds that do not start at 0 or are not increasing', async () => {
    const { service } = make();
    const base = { pointsPerReview: 1, pointsPerContribution: 1, pointsPerHelpfulVote: 1 };
    await expect(service.update('gamification', { ...base, levelThresholds: [10, 20, 30, 40, 50] }, 'a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('gamification', { ...base, levelThresholds: [0, 100, 100, 200, 300] }, 'a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('gamification', { ...base, levelThresholds: [0, 100] }, 'a')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates footer links', async () => {
    const { service } = make();
    const ok = await service.update('footer', { social: { facebook: ' https://facebook.com/foodmap ' }, links: { contact: 'mailto:hi@foodmap.vn', terms: '/dieu-khoan' } }, 'a');
    expect(ok.social.facebook).toBe('https://facebook.com/foodmap');
    expect(ok.social.tiktok).toBe('');
    await expect(service.update('footer', { social: { facebook: 'javascript:alert(1)' } }, 'a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('footer', { links: { terms: '//evil.com' } }, 'a')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the About shape, falls back on blanks and requires ICU placeholders', async () => {
    const { service } = make();
    const saved = await service.update('about', { vi: { score: { title: 'Tiêu đề mới', body: '   ' }, bogus: 'x' } }, 'a');
    expect(saved.vi.score.title).toBe('Tiêu đề mới');
    expect(saved.vi.score.body).toBe(DEFAULT_SITE_SETTINGS.about.vi.score.body);
    expect((saved.vi as Record<string, unknown>).bogus).toBeUndefined();
    expect(saved.en).toEqual(DEFAULT_SITE_SETTINGS.about.en);
    await expect(service.update('about', { vi: { levels: { levelLabel: 'Cấp' } } }, 'a')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates the scoring threshold', async () => {
    const { service } = make();
    expect((await service.update('scoring', { minVotesThreshold: 8 }, 'a')).minVotesThreshold).toBe(8);
    await expect(service.update('scoring', { minVotesThreshold: 0 }, 'a')).rejects.toBeInstanceOf(BadRequestException);
  });
});
