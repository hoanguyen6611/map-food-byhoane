# Module 2 — Authentication & Profile

## Context

Module 1 (foundations) is done: NestJS skeleton with empty module shells, migrations for Identity+Restaurant Core tables, mobile/admin navigation shells. This module implements the first real feature. Read before starting:
- `docs/01-prd-mvp.md` §10.1 (Authentication feature spec).
- `docs/02-user-stories.md` Epic A (US-A1 through US-A5) — implement to these acceptance criteria exactly.
- `docs/06-database-erd.md` §2 (User, UserProfile, Role, Permission, RolePermission field definitions).
- `docs/04-screen-list.md` screens 4-6 (Login, Register, Forgot Password) and screen 24 (Edit Profile).
- `docs/07-tech-stack.md` §2 for the auth approach (JWT access 15min + rotated refresh token 7-30 days, Passport strategies, Google/Apple OAuth).

## Scope

### Backend — `AuthModule` + `UserModule`
- `POST /auth/register` — email+password, creates `User` (role=`user`) + `UserProfile` (displayName defaulted), returns access+refresh token pair.
- `POST /auth/login` — email+password, validates against `passwordHash` (bcrypt/argon2 — never store plaintext), returns token pair. Generic error message on failure (do not reveal whether the email exists).
- `POST /auth/oauth/google` and `POST /auth/oauth/apple` — accept a provider ID token from the client, verify it server-side against the provider's public keys (do not trust client-asserted identity), upsert a `User` by `(oauthProvider, oauthSubjectId)`.
- `POST /auth/refresh` — accepts a valid refresh token, rotates it (invalidate old, issue new), returns new pair. Store refresh tokens hashed, not plaintext, so a DB leak doesn't directly yield usable tokens.
- `POST /auth/logout` — invalidates the current refresh token.
- `POST /auth/forgot-password` — generates a single-use, 30-minute-expiry reset token, "sends" it (for MVP, log it or use a real transactional email provider if credentials are available — do not block the module on email infra; a console-logged link is acceptable for local dev). Response is identical whether or not the email exists.
- `POST /auth/reset-password` — consumes the token once, sets new `passwordHash`, invalidates the token immediately after use (verify this with a test: reusing the same link must fail).
- `GET /me` — returns current user + profile.
- `PATCH /me/profile` — updates `displayName`, `avatarPhotoId` (accept a pre-uploaded photo ID; full media upload pipeline arrives in Module 7 — for now just accept a nullable string ID field), `phone`, `bio`, `homeCity`.
- `DELETE /me` — account deletion: per PRD Business Rule 6, this is NOT a hard delete. Anonymize `User.email`/`phone`/`UserProfile` fields, set `status='deleted'`, keep the row (and all authored content) intact for moderation/audit integrity.
- RBAC guard/decorator (`@Roles('admin','moderator')` style) usable by later modules — implement it now since every admin-facing endpoint from Module 5 onward depends on it. Enforce `RolePermission` lookups, cached in-memory per request (or short-TTL Redis cache) to avoid a DB hit per permission check.
- Rate limiting: apply to `/auth/login`, `/auth/register`, `/auth/forgot-password` — 5 attempts per 15 minutes per identifier (email or IP), per PRD business rule. Use Redis-backed sliding window (this is one of the reasons Redis is in the stack per `docs/07-tech-stack.md`).

### Mobile — screens (per `docs/04-screen-list.md`)
Implement Splash, Onboarding, Permission Location (can be a thin wrapper if Module 1 already stubbed navigation — build the real permission-request logic now), Login, Register, Forgot Password, and wire Edit Profile (screen 24) even though Favorites/Notifications (which Profile also links to) are still placeholders until later modules.
- Secure token storage (`expo-secure-store`, not AsyncStorage, since tokens are sensitive).
- An auth interceptor on the API client: attach access token to requests, on 401 attempt one silent refresh-and-retry, on refresh failure force logout to Login.
- Implement the **guest browsing / soft auth-gate** pattern from `docs/03-sitemap-userflow.md` §2.2: an `AuthGateModal` component that later modules (Favorite, Write Review, Add Restaurant) will trigger — build the reusable component now even though nothing calls it yet in this module, and add a note in code for future modules to wire it in.

### Admin web — Admin Login only
Implement screen 28 (Admin Login) per `docs/04-screen-list.md` — a separate login form hitting a distinct check that `role` is `admin` or `moderator` (reuse `/auth/login` but reject non-admin/moderator roles from the admin app specifically, with a clear "not authorized for admin portal" message rather than a generic failure).

## Explicitly out of scope
No restaurant/review/media logic. No push notification wiring (that's transactional notifications in Module 8). No email-sending infrastructure setup beyond a documented stub — don't build a production email service integration here.

## Definition of Done
Verify directly against `docs/02-user-stories.md` Epic A acceptance criteria:
- [ ] US-A1–A5 all pass manually and have automated API tests (per `docs/09-testing-plan.md` automation priority #1).
- [ ] Refresh token rotation verified: using an old (rotated-out) refresh token fails.
- [ ] Rate limiting verified: 6th login attempt within 15 minutes is blocked with a clear cooldown message.
- [ ] Password reset link is single-use (second use fails) and expires after 30 minutes.
- [ ] Mobile: full flow of Register → auto-login → Home Map (placeholder) → Profile → Edit Profile → Save → Logout → Login works end-to-end on a real simulator/emulator.
- [ ] Admin web: a `user`-role account is rejected from Admin Login; an `admin`-role account succeeds.
- [ ] No plaintext password or refresh token anywhere in the database (spot-check the DB directly).
