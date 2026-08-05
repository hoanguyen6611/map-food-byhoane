import Constants from 'expo-constants';
import type { ApiErrorResponse, AuthResponse } from '@foodmap/shared-types';
import { secureStorage } from '../lib/secureStorage';
import { useAuthStore } from '../store/authStore';

/**
 * Base URL resolution (see app.config.ts for the full explanation of the
 * chosen approach): the value is set via the `API_BASE_URL` env var / `.env`
 * file, forwarded into `extra.apiBaseUrl` by app.config.ts, and read here at
 * runtime via `expo-constants` (plain `process.env.API_BASE_URL` is not
 * available inside the on-device JS bundle, only inside the Node.js context
 * that evaluates app.config.ts).
 */
const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:3000';

/** Thrown by `apiClient` methods when the backend responds with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorResponse | undefined;

  constructor(status: number, body: ApiErrorResponse | undefined) {
    super(typeof body?.message === 'string' ? body.message : `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// Endpoints that must never trigger the 401 refresh-and-retry dance
// themselves (either because they ARE the refresh call, or because a 401
// from them is an expected credential failure, not an expired-session
// signal).
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

async function rawFetch(path: string, init: RequestInit & { accessToken?: string | null }): Promise<Response> {
  const { accessToken, ...rest } = init;
  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...rest.headers,
    },
  });
}

async function parseBody<T>(response: Response): Promise<T> {
  // Don't gate this on `response.status === 204` — a void-returning endpoint
  // that isn't explicitly annotated `@HttpCode(204)` on the backend sends an
  // empty body with a 200/201 status instead, and `response.json()` throws a
  // SyntaxError on empty text. Checking the actual body handles both cases
  // and can't regress if a future endpoint forgets the annotation.
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

// Ensures at most one silent refresh is in flight at a time; concurrent 401s
// piggyback on the same refresh attempt instead of each rotating the token.
let refreshPromise: Promise<boolean> | null = null;

/** Attempts exactly one silent token refresh. Returns whether it succeeded. */
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) {
          return false;
        }
        const response = await rawFetch('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) {
          return false;
        }
        // Refresh tokens rotate on every use: the old one is now invalid,
        // so we MUST persist the new refreshToken from this response, not
        // just the new accessToken, or the session dies on the next refresh.
        const data = await parseBody<AuthResponse>(response);
        await secureStorage.setTokenPair(data.accessToken, data.refreshToken);
        useAuthStore.getState().setUser(data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await secureStorage.getAccessToken();
  let response = await rawFetch(path, { ...init, accessToken });

  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const newAccessToken = await secureStorage.getAccessToken();
      response = await rawFetch(path, { ...init, accessToken: newAccessToken });
    } else {
      // Refresh itself failed (no refresh token, or it's expired/revoked):
      // drop the session so RootNavigator's conditional render falls back
      // to the Auth stack (see task 7) — no imperative navigation needed.
      await secureStorage.clearTokens();
      useAuthStore.setState({ user: null, isAuthenticated: false });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
    throw new ApiError(response.status, body);
  }

  return parseBody<T>(response);
}

/**
 * Typed HTTP client for the backend REST API. Automatically attaches
 * `Authorization: Bearer <accessToken>` when a token is stored, and on a 401
 * performs exactly one silent `POST /auth/refresh` + retry (see
 * docs/build-prompts/02-auth.md "Mobile — screens").
 */
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { API_BASE_URL };
