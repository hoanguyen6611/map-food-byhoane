import { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { SplashScreen } from '../screens/root/SplashScreen';
import { PermissionLocationScreen } from '../screens/root/PermissionLocationScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack, conditionally rendered per docs/build-prompts/02-auth.md task
 * 7 (React Navigation's auth-flow pattern: swap which screen is mounted
 * based on state, never an imperative `navigation.navigate` across stacks):
 *
 *   1. Splash, until `authStore.isHydrated` is true (SplashScreen triggers
 *      hydration on mount).
 *   2. PermissionLocation, once per app session (local `hasCheckedLocation`
 *      state below — NOT re-shown on logout, since that's driven by
 *      `isAuthenticated` flipping, not a fresh app boot).
 *   3. Then either the Main stack or the Auth stack based on
 *      `authStore.isAuthenticated`. Login/Register storing a session (or
 *      Logout/a failed silent refresh clearing one) flips this store value,
 *      which is sufficient on its own to swap the rendered branch.
 *
 * Onboarding (screen 2) is intentionally NOT wired into this flow: it
 * remains Module 1's inert placeholder (no "has_onboarded" flag exists yet)
 * and is out of Module 2's scope — left for a later module to wire in,
 * mirroring how `AuthGateModal` is built but unused until later modules
 * call it.
 */
export function RootNavigator() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hasCheckedLocation, setHasCheckedLocation] = useState(false);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isHydrated ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
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
