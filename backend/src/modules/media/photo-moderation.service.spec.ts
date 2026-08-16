import { PhotoModerationService } from './photo-moderation.service';

function buildService(moderateImpl: jest.Mock) {
  const claudeGateway = { moderate: moderateImpl } as never;
  const createMock = jest.fn();
  const prisma = { moderationResult: { create: createMock } } as never;
  return { service: new PhotoModerationService(prisma, claudeGateway), createMock };
}

describe('PhotoModerationService.check', () => {
  it('passes the image URL to the gateway and returns its result', async () => {
    const moderate = jest.fn().mockResolvedValue({
      riskScore: 0.1,
      labels: [],
      aiReason: 'Ảnh món ăn bình thường.',
      recommendedAction: 'auto_approve',
    });
    const { service } = buildService(moderate);
    const result = await service.check('https://storage.example.com/photo.jpg');
    expect(moderate).toHaveBeenCalledWith({ text: null, imageUrls: ['https://storage.example.com/photo.jpg'] });
    expect(result.recommendedAction).toBe('auto_approve');
  });

  it('fails safe to hold_for_review with an ai_check_failed label when the gateway throws', async () => {
    const moderate = jest.fn().mockRejectedValue(new Error('network error'));
    const { service } = buildService(moderate);
    const result = await service.check('https://storage.example.com/photo.jpg');
    expect(result.recommendedAction).toBe('hold_for_review');
    expect(result.labels).toEqual(['ai_check_failed']);
    expect(result.riskScore).toBe(1);
  });
});

describe('PhotoModerationService.recordResult', () => {
  it('records decision "approved" for auto_approve, "pending" otherwise', async () => {
    const { service, createMock } = buildService(jest.fn());

    await service.recordResult('photo-1', {
      riskScore: 0.1,
      labels: [],
      aiReason: 'OK',
      recommendedAction: 'auto_approve',
    });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ decision: 'approved', targetType: 'photo', targetId: 'photo-1' }) }));

    createMock.mockClear();
    await service.recordResult('photo-2', {
      riskScore: 0.6,
      labels: ['spam'],
      aiReason: 'Nghi ngờ spam.',
      recommendedAction: 'hold_for_review',
    });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ decision: 'pending' }) }));
  });
});
