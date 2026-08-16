# Full Specification — The Food Map of Vietnam

> **Status**: as-built, current-state documentation. Unlike `01-prd-mvp.md` through `09-testing-plan.md` (the original product/build plan), this document describes the system **as it is actually implemented today**, across backend, admin web, and mobile. Where the implementation has diverged from or gone beyond the original plan, this doc reflects reality. Last generated: 2026-08-14.

## 1. Product overview

The Food Map of Vietnam is a restaurant discovery and review platform with three client surfaces sharing one backend:

- **Backend** (`backend/`) — NestJS modular monolith, PostgreSQL+PostGIS (Prisma), Redis, S3-compatible storage, Anthropic Claude for moderation/AI summaries, Expo push delivery.
- **Admin Web** (`admin-web/`) — Vite/React internal tool for admins and moderators to manage restaurants, review moderation queue, published reviews, and users.
- **Mobile** (`mobile/`) — Expo/React Native (SDK 57) end-user app, recently reskinned to the "Ngon v3" design language (4-tab + floating "Write" shortcut navigation).
- **Public Web** (planned, not started) — Next.js SEO-focused end-user site; scoped as Phase 1.5, to begin only after the mobile MVP is complete. See `docs/build-prompts/09-public-web.md`.

### Cross-cutting architecture facts

- Single Prisma schema (`backend/prisma/schema.prisma`) is the one source of truth for the data model; both admin-web and mobile talk to the same REST API, no separate GraphQL/BFF layer.
- Auth is uniform across clients: `POST /auth/login` issues a short-lived JWT access token + opaque refresh token pair for anyone, regardless of role. Admin-web additionally rejects (client-side) any role outside `{admin, moderator}` after that same login call — there is no separate admin login endpoint.
- Every piece of user/community-submitted content (reviews, contributions, photos) passes through the same moderation primitives (`ModerationResult`, Claude gateway with a rule-based fallback, a shared risk-score threshold) before going live.
- "Never fabricate fake statistics" is an explicit, repeated design principle in the mobile codebase: static placeholder *goals*/*labels* are used freely where no backend concept exists yet, but no screen invents fake counts, histograms, or activity about real user-generated content — gaps are shown honestly (`"—"`, "chưa có", "coming soon") instead.

---

## 2. Backend (`backend/`)

**Stack**: NestJS (modular monolith) · PostgreSQL + PostGIS via Prisma (raw `$queryRaw` for geo/full-text search) · Redis (cache + rate-limiting + BullMQ queues) · S3-compatible object storage (MinIO locally) · Anthropic Claude (moderation + AI summaries) · Expo push.

### 2.1 Global setup

- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — unknown fields rejected, DTOs auto-transformed.
- Global `AllExceptionsFilter`; `LoggingMiddleware` on all routes.
- CORS via `CORS_ORIGINS` env var (comma-separated origins, `credentials: true`).
- No Swagger/OpenAPI module registered.
- BullMQ (via `REDIS_URL`) runs two in-process worker queues: `composite-score` (recompute job) and `photo-cleanup` (hourly orphan sweep, self-scheduling).
- Modules wired in `AppModule`: Auth, User, Restaurant, Search, Review, Favorite, Media, Contribution, Moderation, Notification, Ai, Admin (+ Prisma/Redis/Health infra modules).

**Key environment variables** (`env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`, OAuth provider IDs/secrets (Google/Apple/Facebook), S3 connection settings, `AI_SUMMARY_MIN_REVIEW_COUNT`/`AI_SUMMARY_REFRESH_INTERVAL_DAYS`, `ANTHROPIC_API_KEY` (absent → rule-based text moderation fallback, images always held for review, summaries never generated), `AI_MODERATION_MODEL`/`AI_MODERATION_TIMEOUT_MS`, `AI_SUMMARY_MODEL`.

### 2.2 Data model (`prisma/schema.prisma`)

- **Identity & access**: `Role` ⟷ `Permission` (via `RolePermission`); `User` (email, passwordHash?, oauth fields, status, lastLoginAt) has one `UserProfile`, many `RefreshToken` (hashed, rotation-tracked), `PasswordResetToken`.
- **Restaurant core**: `Restaurant` (name, slug, description, category, priceRange, 1:1 `Address`/`Location` with PostGIS geo-point kept in sync by DB trigger, soft-deletable, generated tsvector search column) + `RestaurantStatus` (1:1 — publicationStatus, compositeScore, reviewCount, lastReviewAt — the denormalized cache every read path uses). Also `RestaurantCuisine` (m:n), `Dish` (curated catalog with alias keywords), `OpeningHour` (per weekday), `RestaurantFacility`, `Menu`→`MenuItem`.
- **Reviews & ratings**: `Review` (overall rating, comment, dishes ordered, bill total, party size, wait time, would-return, status, soft-deletable; one active review per user per restaurant enforced by a hand-written partial unique index) + `ReviewRating` (per-criterion score) + `ReviewCriteria` (optionally category-scoped).
- **Media**: `Photo` — polymorphic owner (`ownerType`/`ownerId`, nullable until reparented), storage keys, `status` gating public visibility.
- **Moderation & trust**: `ModerationResult` (polymorphic target, riskScore, labels, recommendedAction, decision, decidedBy/At — DB CHECK forbids AI self-approval of high-risk content) + `Report` (unique per reporter+target).
- **Contribution**: `Contribution` (generic envelope: new_restaurant / edit_suggestion / status_update / closure_report, JSON payload, status, linked ModerationResult) + `EditSuggestion` (1:1 detail row for edit-suggestion contributions).
- **AI Summary**: `AISummary` (1:1 per restaurant — summaryText, pros/cons, sourceReviewCount, modelVersion).
- **Situational status**: `CrowdedStatus`/`SeatAvailability`/`PowerOutletStatus` (insert-only logs, "current" value derived from most-recent row) + `ParkingInformation` (1:1, upserted).
- **Favorites & notifications**: `Favorite` (unique user+restaurant), `Notification` (typed payload + deep-link, isRead), `PushToken` (per-device, unique token).
- **System**: `AuditLog` (append-only, every admin/moderator mutation) + `SearchHistory` (write-only, feeds future personalization).

### 2.3 Modules & endpoints

#### `auth` — base `/auth`, `RateLimitGuard` (Redis sliding-window, 5/15min on sensitive routes)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | public | Create user, issue session |
| `POST /auth/login` | public | Email/password login, generic error message (no user enumeration) |
| `POST /auth/oauth/{google,apple,facebook}` | public | Verify provider token, link-or-create, issue session |
| `POST /auth/refresh` | public | Rotate refresh token (new issued before old revoked) |
| `POST /auth/logout` | public (body-based) | Revoke a given refresh token |
| `POST /auth/forgot-password` | public | Always-identical response; creates 30-min reset token; **email send is a dev-log stub, no real provider wired** |
| `POST /auth/reset-password` | public | Consume token, set new password, revoke all refresh tokens |

JWT payload: `{ sub, role, roleId }`. Permission checks combine coarse `@Roles`/`RolesGuard` with fine-grained `@RequirePermissions`/`PermissionsGuard` (60s in-memory cache of roleId→permission codes).

#### `user` — base `/me`, all `JwtAuthGuard`

`GET /me` (profile + resolved avatar URL) · `PATCH /me/profile` (partial update, avatarPhotoId validated as an owned approved photo) · `DELETE /me` (soft, anonymizing delete — never hard-deletes, preserves review/contribution audit integrity).

#### `restaurant` — base `/restaurants`, all public

`GET /restaurants/nearby` (PostGIS radius search, clamped 0.1–20km, capped 200 results) · `GET /restaurants/bounds` (viewport query, Redis-cached 45s) · `GET /restaurants/sitemap-index` (public-web sitemap feed) · `GET /restaurants/slug/:slug` · `GET /restaurants/:id` (full detail incl. opening-hours/isOpenNow, facilities, menus, photos, 5 newest reviews) · `GET /restaurants/:id/ai-summary` (only returns available if a fresh `AISummary` row exists and review count still meets the minimum).

Notes: `isOpenNow` computed on fixed UTC+7 (no DST), correctly handles overnight hours. Viewport cache invalidated by a global version counter bumped on every admin restaurant mutation.

#### `search` — `GET /search` (with `q`) and `GET /restaurants` (browse, no `q`) share one implementation

Full-text (`tsvector`) OR trigram name-similarity OR dish/alias match, ranked by `GREATEST(ts_rank_cd, similarity)`, then compositeScore, then distance, then recency. Filters: distance, price range, min rating, open-now, facilities (ALL-of), cuisine (ANY-of), category, district/province/ward. `openNow`/`minRating` applied in JS post-hydration. Every call writes a write-only `SearchHistory` row.

#### `review` — three controllers: `/reviews`, `/restaurants/:restaurantId/reviews`, `/me/reviews`

`POST /reviews` (create-or-update the caller's one active review per restaurant, 10/hr rate limit) · `PATCH /reviews/:id` (owner-only; `editedAt` set only >48h post-creation) · `DELETE /reviews/:id` (soft, triggers recompute) · `GET /restaurants/:restaurantId/reviews` (public, paginated, per-criteria breakdown; `sort=has_photos`/`most_helpful` — the latter silently degrades to newest, no helpfulness-vote model exists) · `GET /me/reviews` (caller's full history, all statuses).

**Composite score** (Bayesian average, `composite-score.util.ts`): `(v/(v+m))·R + (m/(v+m))·C`, m=5, C=global average (fallback 3.5). Recomputed via BullMQ on every review mutation; always triggers an AI-summary regeneration check afterward.

**Moderation**: Claude text-risk check + a structural "rapid-fire" escalation (≥5 reviews/hour by one user never downgrades a Claude reject). Any Claude failure is converted to a fail-safe `hold_for_review`.

#### `favorite` — all `JwtAuthGuard`

`POST`/`DELETE /favorites/:restaurantId` (idempotent) · `GET /me/favorites` (paginated) · `GET /me/favorites/ids` (unpaginated id set, for O(1) client-side "is favorited" checks).

#### `media` — base `/media`, all `JwtAuthGuard`

`POST /media/upload-url` (validated content-type/size, presigned S3 PUT, 300s expiry) · `POST /media/confirm` (HEAD size check + magic-byte sniff + **server-side re-encode to JPEG**, never trusts client content-type; per-owner-type caps; **synchronous moderation before returning**) · `DELETE /media/:id` (owner or admin/moderator).

`reparent()` atomically re-points unattached photos onto a real owner (review=6/restaurant=10/contribution=10/user_profile=1 caps). `sweepOrphans()` hourly-deletes unattached photos >24h old.

#### `contribution` — all `JwtAuthGuard`, any `user` role

`POST /restaurants/duplicate-check` · `POST /restaurants` (submit new restaurant, 10/hr limit, 409 on unconfirmed duplicate candidates) · `POST /restaurants/:id/edit-suggestions` (allow-listed fields only) · `POST /restaurants/:id/status-reports` (crowded/seat/outlet/parking/hours_change/moved/wrong_info/closure) · `GET /me/contributions` · `GET /contributions/:id` (owner-only).

**Finalize workflow**: `auto_approve` applies the side-effect immediately (publish restaurant / patch field / insert status row / upsert parking); closure reports are **never** auto-applied. **Closure escalation rule**: 3+ distinct users' closure reports on the same restaurant within 14 days force the latest into manual review (never reopens an already-human-decided item, never auto-hides the restaurant).

#### `moderation` — shared primitives + user reports

`POST /reports` (report a restaurant/review; unique per reporter+target; ensures queue visibility). Shared constants: `MEDIUM_RISK_THRESHOLD = 0.5` is the single source of truth for `auto_approve`/`hold_for_review` boundary across both the Claude path and the zero-network rule-based fallback (URL detection, spam-phrase list, caps-ratio, repeated-char patterns — never produces `reject` on its own). `assertDecisionAllowed` is the app-level twin of a DB CHECK: AI can never self-approve high-risk content.

#### `notification` — all `JwtAuthGuard`

`GET /me/notifications` (paginated + unreadCount) · `PATCH /me/notifications/:id/read` · `POST`/`DELETE /me/push-tokens[/:token]`.

The only real producer today is `AdminModerationService.decide()` (moderation_result/contribution_status notifications). Push delivery (Expo SDK) is best-effort — failures logged, never block the notification write; stale `DeviceNotRegistered` tokens are auto-deleted.

#### `ai` — internal only, no own controller

`ClaudeGatewayService.moderate()` (claude-haiku-4-5, 8s timeout, structured JSON, images sent as base64 vision blocks; no API key → rule-based text fallback, images always held) and `.summarize()` (claude-opus-5, up to 50 recent commented reviews, no fallback by design — an honest "no summary yet" state on failure, never fabricated). `AiSummaryService.regenerateIfNeeded()` fires off the review-mutation path via BullMQ, regenerates on first threshold-crossing and every N days thereafter, fully fail-safe.

#### `admin` — five controllers, `JwtAuthGuard` + `RolesGuard`

- **Dashboard** (`admin`+`moderator`): `GET /admin/dashboard` — KPIs + 30-day activity series + rating distribution.
- **Moderation** (`admin`+`moderator`, no restriction): `GET /admin/moderation-queue`, `POST /admin/moderation-queue/:id/decision`, `PATCH /admin/reports/:id/resolve`.
- **Restaurant** (`admin`+`moderator`; hard delete **admin-only**): full CRUD, hide/restore, opening-hours/facilities full-replace, menu-item CRUD, photo attach/remove (admin-supplied URL, bypasses user moderation). Every mutation invalidates the viewport cache and writes an `AuditLog`.
- **Review** (`admin`+`moderator` list; hide/restore/hard-delete **admin-only**): manages already-*published* reviews, distinct from the moderation queue's pre-publish decisions.
- **User** (`admin`+`moderator` list/detail; suspend/reactivate/role-change **admin-only**): search/filter, suspend, reactivate, role change. Rules: an admin can never suspend/role-change themselves; the system's last active admin can never be suspended/demoted.

`AuditLogService.record()` is called at every admin mutation site.

---

## 3. Admin Web (`admin-web/`)

**Stack**: Vite + React + TypeScript, React Router, TanStack React Query, hand-rolled inline-SVG charts (no charting library).

### 3.1 Architecture

- **Auth**: no dedicated admin login endpoint — calls the same `POST /auth/login`, then client-side rejects (and discards the token for) any role outside `{admin, moderator}`. Session (`{accessToken, user}`) persisted in `localStorage` (short-lived 15-min tokens, treated as a low-sensitivity internal tool); no refresh-token flow — a 401 just surfaces as an error.
- **Routing**: `/login` public; everything else behind `ProtectedRoute` + `AppLayout` (sidebar/header shell). Routes: `/` (dashboard), `/restaurants`, `/restaurants/new`, `/restaurants/:id`, `/moderation`, `/reviews`, `/users`.
- **API client**: thin `fetch` wrapper, auto-attaches bearer token, parses NestJS's error shape into a typed `ApiError`.
- **Role gating pattern**: sensitive/destructive actions restricted to `admin` are *disabled* (not hidden) for `moderator`, with an explanatory tooltip.
- **List-page convention** (shared across all 4 management pages): debounced search, filter dropdowns resetting to page 1, React Query with `placeholderData: previous`, manual prev/next pagination.

### 3.2 Pages

| Page | Route | Purpose | Key API calls |
|---|---|---|---|
| **AdminLoginPage** | `/login` | Gatekeeper login for admin/moderator only | `POST /auth/login` |
| **AdminDashboardPage** | `/` | KPI cards (pending restaurants/reviews, new reports, active users) each deep-linking to a filtered destination page; 7/30-day activity chart; rating-distribution chart | `GET /admin/dashboard` |
| **AdminModerationQueuePage** | `/moderation` | Tabbed by target type (review/contribution/photo/video/reported restaurant), filterable by decision, expandable decision panel (reason required unless approving), inline nested-report resolution | `GET /admin/moderation-queue`, `POST /admin/moderation-queue/:id/decision`, `PATCH /admin/reports/:id/resolve` |
| **AdminRestaurantManagementPage** | `/restaurants` | Search/filter by status/province/ward/legacy district; per-row hide/restore/hard-delete (delete admin-only) | `GET /admin/restaurants`, `POST :id/hide`, `POST :id/restore`, `DELETE :id` |
| **AdminRestaurantEditPage** | `/restaurants/new`, `/restaurants/:id` | Create/edit core fields; 4 independent sub-sections: opening hours (7-row full-replace), facilities (full-set replace), menu (inline CRUD), photos (URL-based, no upload pipeline) | `GET/POST/PATCH/DELETE /admin/restaurants[/:id]`, `PUT :id/opening-hours`, `PUT :id/facilities`, menu-item and photo endpoints |
| **AdminReviewManagementPage** | `/reviews` | Manage already-published reviews (distinct from the moderation queue); search, status/risk-score filters, deep-link context filter (restaurantId/userId); hide/restore/delete are admin-only, delete uses a rare **double confirm** | `GET /admin/reviews`, `PATCH :id/hide`, `PATCH :id/restore`, `DELETE :id` |
| **AdminUserManagementPage** | `/users` | Search/filter by role/status; expandable detail panel (review count, reports-received count); suspend/reactivate/role-change (admin-only, blocked for self) | `GET /admin/users[/:id]`, `PATCH :id/suspend`, `PATCH :id/reactivate`, `PATCH :id/role` |

### 3.3 Notable inconsistency

Restaurant Management restricts only **hard delete** to admin (hide/restore open to moderators), while Review Management restricts **all three** (hide/restore/delete) to admin. This asymmetry exists in both the frontend gating and the backend `@Roles` overrides — intentional per the backend module design (moderators fully own the pre-publish moderation queue but not post-publish review takedowns), but worth knowing when reasoning about "what can a moderator do."

---

## 4. Mobile (`mobile/`) — "Ngon v3"

**Stack**: Expo/React Native (SDK 57) · React Navigation (native-stack + bottom-tabs, custom floating tab bar) · TanStack React Query · Zustand · i18next · `react-native-maps` + clustering · hand-rolled `fetch` API client with silent-refresh auth.

### 4.1 Navigation graph

```
RootNavigator (conditional-render on authStore.isAuthenticated, no imperative cross-stack nav)
 ├─ Splash / Onboarding / PermissionLocation
 ├─ Auth → Login / Register / ForgotPassword
 └─ Main → MainStack
      ├─ MainTabs (Ngon v3 floating pill bar)
      │    ├─ Home / Explore / Saved / Profile   (4 real tab routes)
      │    └─ "Viết" (Write)                       (5th icon, NOT a route — see below)
      ├─ Search { mode?; category? } · SearchResult { query?; mode?; category? } · Filter (modal)
      ├─ Map (pushed, not a tab)
      ├─ RestaurantDetail / PhotoGallery / Menu / Reviews / WriteReview (modal) { restaurantId }
      ├─ AddRestaurant (modal) / SelectLocation / UploadMedia / SubmissionStatus { contributionId }
      ├─ EditProfile / MyReviews / MyContributions / Notifications / Settings
      └─ ReportContent (modal) { targetType; targetId }
```

**"Viết" (Write) shortcut**: rendered only by `FloatingTabBar` (not in `MainTabParamList`), navigates the parent stack to `SearchResult{mode:'writeReview'}`, reusing the existing search flow as a "pick a restaurant, then review it" step — a card tap there routes to `WriteReview` instead of `RestaurantDetail`. `Map` moved off the tab bar into a pushed stack screen (reached via Explore's map teaser).

A top-level `navigationRef` in `App.tsx` (above `MainStack`) handles push-notification-tap deep links into any `MainStack` screen.

### 4.2 Screens

**Root**: Splash (hydrates auth from secure storage) · Onboarding (3-slide, one-time AsyncStorage flag, emoji placeholder illustrations) · PermissionLocation (foreground location request, Skip never blocks entry).

**Auth**: Login (email/password + Google/Facebook/Apple) · Register (password policy + terms checkbox) · ForgotPassword (60s resend cooldown). All fully real-data-backed.

**Main — real-data-backed screens**: SearchResult, FilterScreen, RestaurantDetail, PhotoGallery, Menu, ReviewsScreen, WriteReview, AddRestaurant (4-step wizard, deliberately excludes opening-hours/facilities/menu from the submission flow — addable later via edit suggestions), SubmissionStatus (polls every 5s while pending), EditProfile, MyReviews, MyContributions, NotificationsScreen (list/read/deep-link plumbing is real; **no real producer exists yet** beyond admin moderation decisions), SettingsScreen, ReportContent.

**Main — screens with explicit placeholder pieces** (all clearly commented in code, per the "never fabricate real-content statistics" principle):
- **HomeScreen** — static city label (no reverse-geocoding); gamification banner's goal number is a fixed placeholder (the review-count progress itself is real); grid shows restaurants, not per-dish data (no dish-level reviews exist).
- **ExploreScreen** — "Xu hướng"/"Mới mở" segments query the identical "browse near me" data as "Gần tôi" (no distinct backend sort yet); leaderboard is real (top-5 by compositeScore) but not literally time-windowed to "this week."
- **SavedScreen** — "Muốn thử"/"Đã đi" split is a **local-only** AsyncStorage tag (no server-side field); "Danh sách" (custom lists) is a static "coming soon" placeholder, no backend concept exists.
- **ProfileScreen** — review-count stat is real; photo-count/likes-received render a static `"—"` (never a fake number); badge goal is a fixed placeholder.
- **MapScreen** — manual "choose area" fallback (when location denied) is a hardcoded 3-item HCMC list, standing in for real geocoding search.
- **RestaurantDetailScreen** — AI summary section is honestly read-only (no live regenerate trigger from mobile); labeled "AI-generated" whenever shown.
- **SearchScreen** — recent/popular suggestions are local-only (AsyncStorage + hardcoded list), no live autocomplete network call.
- **SelectLocationScreen** — no geocoding provider wired in; always shows raw lat/lng, never a resolved street address (documented as a future swap-in once a provider like Goong Maps is credentialed).
- **UploadMediaScreen** — not a real standalone flow; `PhotoUploadGrid` is the actual reusable unit embedded by AddRestaurant/WriteReview. This route stays reachable but nothing currently navigates to it.

### 4.3 State management

| Store | Holds |
|---|---|
| `useAuthStore` | Derived auth status + cached user DTO (tokens live in `expo-secure-store`, not the store) |
| `useFilterStore` | Shared search/browse filter criteria, persists across Home/Explore/Map/Search/SearchResult/Filter navigation (in-memory only, resets on app restart) |
| `useAddRestaurantDraftStore` | Transient location handoff from `SelectLocationScreen` to `AddRestaurantScreen` |

Plus AsyncStorage-backed local state outside Zustand: theme preference, locale preference, onboarding flag, recent searches, Saved screen's visited tags.

### 4.4 API client, push, i18n

- **API client**: base URL from `app.config.ts`'s `API_BASE_URL`; every request attaches a bearer token from secure storage; exactly one deduped silent `POST /auth/refresh` retry on 401, then falls back to logged-out state (no imperative navigation — `RootNavigator`'s conditional render handles it).
- **Push**: Expo push tokens, registered on login, unregistered on logout, foreground handler shows banner+list. Tap handling deep-links via the top-level `navigationRef`. Real delivery is **unverifiable in this dev environment** (no physical device/APNs credentials configured) — plumbing is complete and correct per Expo's API contract.
- **i18n**: `vi` (default) / `en`, dev-time key-parity guard between the two locale files, `LocaleContext` mirrors `ThemeContext` (system/vi/en, AsyncStorage-persisted, user-overridable in Settings).

---

## 5. Known gaps / honest placeholder inventory

A consolidated list of everything in the product that is UI-complete but not (yet) backed by real data or a real backend concept — useful as a roadmap input:

| Area | Gap | Where |
|---|---|---|
| Gamification | No badge/achievement backend; goal numbers are fixed placeholders | Home banner, Profile badge bar |
| Per-dish data | No dish-level rating/like/price aggregation | Home grid (shows restaurants, not dishes) |
| Trending/new sort | No distinct backend sort for "trending" or "newly opened" | ExploreScreen segments |
| Saved custom lists | No schema for user-named restaurant lists | SavedScreen "Danh sách" tab |
| Visited tag | No server-side "visited" flag on Favorite | SavedScreen (local AsyncStorage only) |
| Profile stats | No photo-count/likes-received aggregate endpoints | ProfileScreen stat row |
| Reverse geocoding | No geocoding provider credentialed | Home city label, SelectLocationScreen |
| Search autocomplete | No live-query network call | SearchScreen (local history + hardcoded popular list only) |
| Review helpfulness | No vote model; "most helpful"/"has photos" sort degrades to newest | ReviewsScreen, backend `GET /restaurants/:id/reviews` |
| Notification producers | Only moderation/contribution-status decisions generate notifications | NotificationsScreen |
| Push delivery verification | No physical device/APNs credentials in this environment | Push notification pipeline |
| Password reset email | Dev-log stub only, no real email provider wired | `POST /auth/forgot-password` |
| Admin photo upload | Admin restaurant photos are pasted URLs, no upload pipeline (distinct from the real user-facing signed-upload flow) | AdminRestaurantEditPage PhotosSection |
| Per-review reporting | `ReportContentScreen` supports reporting a review, but no UI entry point exists yet on any review row (only the restaurant-level Report button, fixed in this pass, calls it) | ReviewsScreen / ReviewCard |
| Public Web | Not started — planned Phase 1.5, after mobile MVP | `docs/build-prompts/09-public-web.md` |

---

## 6. Recent fixes (this pass)

Two UI/feature mismatches were found and fixed while producing this specification:

1. **Write-tab context loss**: the floating tab bar's "Viết" shortcut opens `SearchResult{mode:'writeReview'}`, but its "Sửa tìm kiếm" button navigated to a plain `Search` screen that silently dropped `mode` (and `category`) on re-submission — a user editing their query mid-flow would be bounced back to normal browsing (tapping a result opened the restaurant page instead of the write-review form) with no visible error. Fixed by threading `mode`/`category` through `Search` → `SearchResult` (`mobile/src/navigation/types.ts`, `SearchResultScreen.tsx`, `SearchScreen.tsx`).
2. **Dead report button**: `RestaurantDetailScreen`'s Report action opened a "coming soon" alert even though `ReportContentScreen` (with a real `POST /reports` endpoint) was already fully built — just never wired up from here. Fixed to navigate to `ReportContent{targetType:'restaurant', targetId}`; removed the now-unused placeholder copy and `Alert` import.
