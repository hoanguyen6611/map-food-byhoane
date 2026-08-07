import { ConfigService } from '@nestjs/config';
import { AiSummaryService } from './ai-summary.service';

function buildService(opts: {
  reviewCount: number;
  existingSummary?: { generatedAt: Date } | null;
  commentedReviewCount: number;
  summarizeImpl?: jest.Mock;
  upsertImpl?: jest.Mock;
}) {
  const config = new ConfigService({
    AI_SUMMARY_MIN_REVIEW_COUNT: '5',
    AI_SUMMARY_REFRESH_INTERVAL_DAYS: '7',
  });
  const upsertMock = opts.upsertImpl ?? jest.fn().mockResolvedValue(undefined);
  const prisma = {
    restaurantStatus: { findUnique: jest.fn().mockResolvedValue({ reviewCount: opts.reviewCount }) },
    aISummary: {
      findUnique: jest.fn().mockResolvedValue(opts.existingSummary ?? null),
      upsert: upsertMock,
    },
    review: { count: jest.fn().mockResolvedValue(opts.commentedReviewCount) },
  } as never;
  const claudeGateway = {
    summarize:
      opts.summarizeImpl ??
      jest.fn().mockResolvedValue({ summaryText: 'Tóm tắt', pros: ['Ngon'], cons: [] }),
  } as never;
  return { service: new AiSummaryService(prisma, config, claudeGateway), upsertMock, claudeGateway };
}

describe('AiSummaryService.regenerateIfNeeded', () => {
  it('skips (no Claude call, no upsert) below the minimum review count', async () => {
    const { service, upsertMock, claudeGateway } = buildService({ reviewCount: 2, commentedReviewCount: 2 });
    await service.regenerateIfNeeded('r1');
    expect(upsertMock).not.toHaveBeenCalled();
    expect((claudeGateway as { summarize: jest.Mock }).summarize).not.toHaveBeenCalled();
  });

  it('skips when zero reviews have comment text, even above the threshold', async () => {
    const { service, upsertMock } = buildService({ reviewCount: 10, commentedReviewCount: 0 });
    await service.regenerateIfNeeded('r1');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('skips when an existing summary is still fresh (younger than the refresh interval)', async () => {
    const { service, upsertMock } = buildService({
      reviewCount: 10,
      commentedReviewCount: 10,
      existingSummary: { generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }, // 1 day old
    });
    await service.regenerateIfNeeded('r1');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('regenerates when no summary exists yet and the threshold is met', async () => {
    const { service, upsertMock } = buildService({ reviewCount: 10, commentedReviewCount: 10 });
    await service.regenerateIfNeeded('r1');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0];
    expect(call.create.summaryText).toBe('Tóm tắt');
    expect(call.create.sourceReviewCount).toBe(10);
  });

  it('regenerates when the existing summary is older than the refresh interval', async () => {
    const { service, upsertMock } = buildService({
      reviewCount: 10,
      commentedReviewCount: 10,
      existingSummary: { generatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, // 10 days old
    });
    await service.regenerateIfNeeded('r1');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when Claude fails — logs and swallows the error', async () => {
    const { service, upsertMock } = buildService({
      reviewCount: 10,
      commentedReviewCount: 10,
      summarizeImpl: jest.fn().mockRejectedValue(new Error('network error')),
    });
    await expect(service.regenerateIfNeeded('r1')).resolves.toBeUndefined();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
