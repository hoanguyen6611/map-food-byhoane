import * as webpush from 'web-push';
import { WebPushService } from './web-push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const sendNotification = webpush.sendNotification as jest.Mock;

function makeService(env: Record<string, string | undefined>) {
  const prisma = {
    webPushSubscription: {
      findMany: jest.fn().mockResolvedValue([
        { endpoint: 'https://push.example/a', p256dh: 'p', auth: 'x' },
        { endpoint: 'https://push.example/b', p256dh: 'p', auth: 'x' },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    restaurant: { findFirst: jest.fn().mockResolvedValue({ slug: 'pho-hoa' }) },
  };
  const config = { get: (key: string) => env[key] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new WebPushService(prisma as any, config as any);
  return { service, prisma };
}

const payload = { title: 'T', body: 'B', deepLink: { screen: 'Reviews', restaurantId: 'r1' } };
const KEYS = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };

describe('WebPushService', () => {
  beforeEach(() => sendNotification.mockReset());

  it('is a no-op without VAPID keys', async () => {
    const { service, prisma } = makeService({});
    expect(service.getPublicKey()).toBeNull();
    await service.sendToUser('u1', payload, 'n1', 'review_reply');
    expect(prisma.webPushSubscription.findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to every subscription with a mark-read URL to the reviews tab', async () => {
    sendNotification.mockResolvedValue({});
    const { service } = makeService(KEYS);
    expect(service.getPublicKey()).toBe('pub');
    await service.sendToUser('u1', payload, 'n1', 'review_reply');
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const body = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(body).toEqual({
      title: 'T',
      body: 'B',
      notificationId: 'n1',
      url: `/notifications/open/n1?to=${encodeURIComponent('/restaurant/pho-hoa?tab=reviews')}`,
    });
  });

  it('links non-review types to the plain restaurant page, unknown targets to /notifications', async () => {
    sendNotification.mockResolvedValue({});
    const { service, prisma } = makeService(KEYS);
    await service.sendToUser('u1', payload, 'n2', 'restaurant_hours_changed');
    expect(JSON.parse(sendNotification.mock.calls[0][1]).url).toContain(encodeURIComponent('/restaurant/pho-hoa'));
    expect(JSON.parse(sendNotification.mock.calls[0][1]).url).not.toContain('tab');

    sendNotification.mockClear();
    prisma.restaurant.findFirst.mockResolvedValue(null);
    await service.sendToUser('u1', payload, 'n3', 'contribution_status');
    expect(JSON.parse(sendNotification.mock.calls[0][1]).url).toBe(
      `/notifications/open/n3?to=${encodeURIComponent('/notifications')}`,
    );
  });

  it('deletes subscriptions the push service reports gone (410), keeps others', async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    const { service, prisma } = makeService(KEYS);
    await expect(service.sendToUser('u1', payload, 'n1', 'review_reply')).resolves.toBeUndefined();
    expect(prisma.webPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push.example/a'] } },
    });
  });
});
