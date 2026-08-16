import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NotificationDeepLink } from '@foodmap/shared-types';
import type { MainStackParamList } from '../navigation/types';

// Shared by NotificationsScreen's in-app tap handler and App.tsx's push-tap
// listener (Notifications.addNotificationResponseReceivedListener), so both
// resolve a deep link the exact same way instead of drifting apart. Screens
// this build knows how to deep-link into with the data a NotificationDto
// actually carries — the two real producers are AdminModerationService's
// review decisions ('Reviews', restaurantId) and contribution decisions
// ('SubmissionStatus', contributionId).
//
// A tuple, not an object, so `navigation.navigate(...target)` type-checks
// against React Navigation's overloaded (screen, params) signature.
export type NotificationNavigationTarget =
  | ['Reviews', MainStackParamList['Reviews']]
  | ['SubmissionStatus', MainStackParamList['SubmissionStatus']];

export function resolveNotificationTarget(deepLink: NotificationDeepLink): NotificationNavigationTarget | null {
  const { screen, restaurantId, contributionId } = deepLink;
  if (screen === 'Reviews' && restaurantId) {
    return ['Reviews', { restaurantId }];
  }
  if (screen === 'SubmissionStatus' && contributionId) {
    return ['SubmissionStatus', { contributionId }];
  }
  return null;
}

// For navigating from OUTSIDE the MainStack (App.tsx's push-tap handler,
// which only has the root navigationRef) — a switch, not a direct object
// literal, because TypeScript won't correlate a destructured tuple's two
// elements back into one matching union member on its own.
export function toMainStackNavigatorParams(
  target: NotificationNavigationTarget,
): NavigatorScreenParams<MainStackParamList> {
  const [screen, params] = target;
  switch (screen) {
    case 'Reviews':
      return { screen, params };
    case 'SubmissionStatus':
      return { screen, params };
  }
}
