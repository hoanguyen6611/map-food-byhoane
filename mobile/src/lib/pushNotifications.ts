import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { PushPlatform } from '@foodmap/shared-types';
import { pushTokensApi } from '../api/pushTokens';

// Foreground display config — required as of SDK 57 (shouldShowAlert is
// deprecated in favor of the banner/list split). Runs once at module load,
// same as this file's only import site (App.tsx).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getDeviceToken(): Promise<string | null> {
  // Android 13+ won't even show the permission prompt until a channel
  // exists (see expo-notifications docs) — harmless no-op on iOS.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // Recommended to pass explicitly rather than rely on the
  // Constants.expoConfig.extra.eas.projectId default (expo-notifications
  // docs) — app.config.ts already sets this for EAS builds.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/**
 * Requests permission (if not already granted/denied) and registers this
 * device's Expo push token with the backend. Called once whenever
 * `authStore.isAuthenticated` flips true (see usePushNotifications) — silent
 * no-op if the user denies the permission prompt or we're not on a physical
 * device/real push-capable environment (the iOS Simulator has no APNs
 * connectivity at all, so `getExpoPushTokenAsync` will fail there; that
 * failure is swallowed here by design, same as every other call site).
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    const token = await getDeviceToken();
    if (!token) return;
    const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
    await pushTokensApi.register({ token, platform });
  } catch {
    // Best-effort — matches this module's other calls' swallow-and-continue
    // convention (push is a nice-to-have, never a blocker for using the app).
  }
}

/** Called on logout so a signed-out device stops receiving that user's pushes. */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await pushTokensApi.unregister(token);
  } catch {
    // Best-effort, same rationale as ProfileScreen's refresh-token invalidation on logout.
  }
}
