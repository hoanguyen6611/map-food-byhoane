import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { SplashScreen } from '../screens/root/SplashScreen';
import { OnboardingScreen } from '../screens/root/OnboardingScreen';
import { PermissionLocationScreen } from '../screens/root/PermissionLocationScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { useAuthStore } from '../store/authStore';
import { getHasOnboarded } from '../lib/onboarding';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack, conditionally rendered per docs/build-prompts/02-auth.md task
 * 7 (React Navigation's auth-flow pattern: swap which screen is mounted
 * based on state, never an imperative `navigation.navigate` across stacks):
 *
 *   1. Splash, until BOTH `authStore.isHydrated` is true AND the local
 *      `has_onboarded` flag has been read from AsyncStorage (`onboardChecked`
 *      below) — SplashScreen triggers auth hydration on mount; the
 *      onboarding-flag read runs in parallel via the effect below.
 *   2. Onboarding, once per DEVICE (gated on `hasOnboarded`, not per app
 *      session like the location check) — never re-shown after Bỏ qua/Bắt
 *      đầu sets the flag.
 *   3. PermissionLocation, once per app session (local `hasCheckedLocation`
 *      state below — NOT re-shown on logout, since that's driven by
 *      `isAuthenticated` flipping, not a fresh app boot).
 *   4. Then either the Main stack or the Auth stack based on
 *      `authStore.isAuthenticated`. Login/Register storing a session (or
 *      Logout/a failed silent refresh clearing one) flips this store value,
 *      which is sufficient on its own to swap the rendered branch.
 */
export function RootNavigator() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hasOnboarded, setHasOnboardedState] = useState<boolean | null>(null);
  const [hasCheckedLocation, setHasCheckedLocation] = useState(false);

  useEffect(() => {
    getHasOnboarded().then(setHasOnboardedState);
  }, []);

  const isReady = isHydrated && hasOnboarded !== null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isReady ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : !hasOnboarded ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onDone={() => setHasOnboardedState(true)} />}
        </Stack.Screen>
      ) : !hasCheckedLocation ? (
        <Stack.Screen name="PermissionLocation">
          {() => <PermissionLocationScreen onDone={() => setHasCheckedLocation(true)} />}
        </Stack.Screen>
      ) : isAuthenticated ? (
        <Stack.Screen name="Main" component={MainStackNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
