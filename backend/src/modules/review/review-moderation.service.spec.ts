import { ReviewModerationService } from './review-moderation.service';

function buildService(moderateImpl: jest.Mock, recentCount = 0) {
  const claudeGateway = { moderate: moderateImpl } as never;
  const countMock = jest.fn().mockResolvedValue(recentCount);
  const prisma = { review: { count: countMock } } as never;
  return { service: new ReviewModerationService(prisma, claudeGateway), countMock };
}

describe('ReviewModerationService.check', () => {
  it('passes through Claude auto_approve when no rapid-fire is detected', async () => {
    const moderate = jest.fn().mockResolvedValue({
      riskScore: 0.1,
      labels: [],
      aiReason: 'OK',
      recommendedAction: 'auto_approve',
    });
    const { service } = buildService(moderate, 0);
    const result = await service.check({ userId: 'u1', comment: 'ngon' });
    expect(result.recommendedAction).toBe('auto_approve');
    expect(moderate).toHaveBeenCalledWith({ text: 'ngon' });
  });

  it('escalates auto_approve to hold_for_review when rapid-fire posting is detected', async () => {
    const moderate = jest.fn().mockResolvedValue({
      riskScore: 0.1,
      labels: [],
      aiReason: 'OK',
      recommendedAction: 'auto_approve',
    });
    const { service } = buildService(moderate, 5);
    const result = await service.check({ userId: 'u1', comment: 'ngon' });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toContain('rapid_fire');
  });

  it('never downgrades an existing reject even with rapid-fire layered on top', async () => {
    const moderate = jest.fn().mockResolvedValue({
      riskScore: 0.95,
      labels: ['hate_speech'],
      aiReason: 'Vi phạm nghiêm trọng.',
      recommendedAction: 'reject',
    });
    const { service } = buildService(moderate, 5);
    const result = await service.check({ userId: 'u1', comment: 'x' });
    expect(result.recommendedAction).toBe('reject');
  });

  it('fails safe to hold_for_review with an ai_check_failed label when Claude throws, without touching the DB rapid-fire query', async () => {
    const moderate = jest.fn().mockRejectedValue(new Error('network error'));
    const { service, countMock } = buildService(moderate, 0);
    const result = await service.check({ userId: 'u1', comment: 'x' });
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toEqual(['ai_check_failed']);
    expect(result.riskScore).toBe(1);
    expect(countMock).not.toHaveBeenCalled();
  });
});
