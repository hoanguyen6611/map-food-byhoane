import { ContributionModerationService } from './contribution-moderation.service';

function buildService(moderateImpl: jest.Mock, recentCount = 0) {
  const claudeGateway = { moderate: moderateImpl } as never;
  const countMock = jest.fn().mockResolvedValue(recentCount);
  const prisma = { contribution: { count: countMock } } as never;
  return {
    service: new ContributionModerationService(prisma, claudeGateway),
    countMock,
  };
}

const CLEAN_RESULT = {
  riskScore: 0.1,
  labels: [],
  aiReason: 'OK',
  recommendedAction: 'auto_approve' as const,
};

describe('ContributionModerationService.check', () => {
  it('passes through Claude auto_approve with no structural signals', async () => {
    const moderate = jest.fn().mockResolvedValue(CLEAN_RESULT);
    const { service } = buildService(moderate, 0);
    const result = await service.check({
      userId: 'u1',
      textContent: 'Quán mới rất ngon',
    });
    expect(result.recommendedAction).toBe('auto_approve');
  });

  it('escalates to hold_for_review on abnormal menu pricing', async () => {
    const moderate = jest.fn().mockResolvedValue(CLEAN_RESULT);
    const { service } = buildService(moderate, 0);
    const result = await service.check({
      userId: 'u1',
      textContent: 'Quán mới',
      menuItemPricesVnd: [15_000_000],
    });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toContain('abnormal_price');
  });

  it('escalates to hold_for_review on rapid-fire contribution posting', async () => {
    const moderate = jest.fn().mockResolvedValue(CLEAN_RESULT);
    const { service } = buildService(moderate, 5);
    const result = await service.check({
      userId: 'u1',
      textContent: 'Quán mới',
    });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toContain('rapid_fire');
  });

  it('fails safe to hold_for_review when Claude throws, skipping the structural checks entirely', async () => {
    const moderate = jest.fn().mockRejectedValue(new Error('timeout'));
    const { service, countMock } = buildService(moderate, 0);
    const result = await service.check({
      userId: 'u1',
      textContent: 'x',
      menuItemPricesVnd: [20_000_000],
    });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toEqual(['ai_check_failed']);
    expect(countMock).not.toHaveBeenCalled();
  });
});
