import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { NotificationDeepLink } from '@foodmap/shared-types';
import type { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { resolveNotificationTarget, toMainStackNavigatorParams } from '../lib/notificationNavigation';
import { useMarkNotificationRead } from './useNotifications';

interface PushDataPayload {
  notificationId?: string;
  deepLink?: NotificationDeepLink;
}

/**
 * Registers this device for push once signed in, and handles a tap on a
 * delivered push the same way NotificationsScreen handles an in-app tap:
 * mark read + navigate via the shared `resolveNotificationTarget` (see that
 * file for why it's factored out). Mounted once in App.tsx's AppShell, which
 * owns the top-level `navigationRef` this needs to navigate from outside any
 * screen component.
 */
export function usePushNotifications(navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const markRead = useMarkNotificationRead();

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushDataPayload | undefined;
      if (!data?.deepLink) return;
      if (data.notificationId) {
        markRead.mutate(data.notificationId);
      }
      const target = resolveNotificationTarget(data.deepLink);
      if (target) {
        navigationRef.current?.navigate('Main', toMainStackNavigatorParams(target));
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markRead is a fresh mutation object every render; re-subscribing on it would tear the listener down constantly for no benefit.
  }, [navigationRef]);
}
