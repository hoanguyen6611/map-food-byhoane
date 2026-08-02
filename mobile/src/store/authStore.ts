import { create } from 'zustand';
import type { AuthUserDto } from '@foodmap/shared-types';
import { secureStorage } from '../lib/secureStorage';

interface AuthState {
  user: AuthUserDto | null;
  /** True once boot-time hydration from secure storage has completed. */
  isHydrated: boolean;
  isAuthenticated: boolean;
  /**
   * Persists a fresh token pair + user (register/login) and marks the
   * session authenticated. `RootNavigator` reacts to `isAuthenticated`
   * flipping true and swaps in the `Main` stack (see task 7).
   */
  setSession: (user: AuthUserDto, accessToken: string, refreshToken: string) => Promise<void>;
  /** Updates the cached user (e.g. after `GET /me` / `PATCH /me/profile`) without touching tokens. */
  setUser: (user: AuthUserDto) => void;
  /** Clears tokens + in-memory state (logout, or a failed silent refresh). */
  clearSession: () => Promise<void>;
  /** Boot-time hydration: reads secure storage and restores session state, if any. */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  isAuthenticated: false,

  setSession: async (user, accessToken, refreshToken) => {
    await secureStorage.setTokenPair(accessToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  clearSession: async () => {
    await secureStorage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    // We don't have the user profile persisted locally (only tokens), so
    // hydration just determines whether a session *might* be valid; the
    // access token is verified lazily the first time an authenticated
    // request is made (and silently refreshed/cleared by the API client
    // interceptor if it's expired — see src/api/client.ts).
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getRefreshToken(),
    ]);
    set({ isAuthenticated: Boolean(accessToken && refreshToken), isHydrated: true });
  },
}));
