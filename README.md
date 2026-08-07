# The Food Map of Vietnam

> Nền tảng bản đồ ẩm thực thông minh được xây dựng bởi cộng đồng và AI — không chỉ giúp bạn tìm quán gần nhất, mà giúp bạn tìm đúng quán phù hợp nhất.

This repository holds the full design (`/docs`) and the in-progress implementation for The Food Map of Vietnam: a Vietnam-first food & beverage discovery platform combining a specialized map, structured community reviews, and an explainable AI recommendation layer. It is built as a portfolio project with the architecture and product rigor of a real, fundable product.

**Current status: Modules 1-6 and 8 complete, plus Module 9 (Phase 1.5 Public Web); Module 7 not yet started.** Foundations, Authentication & Profile, Map & Geospatial Core, Search & Filter, Restaurant Detail + Admin Seed Tooling (real 40-restaurant HCMC demo dataset), Reviews & Composite Scoring (Bayesian-damped scoring, rule-based moderation stand-in), Favorites/Notifications/Security-Performance-Accessibility hardening, and a server-rendered, SEO-focused public web app are implemented, tested, and verified working end-to-end — see [Getting Started](#getting-started) to run it, and [Status](#status) for what's next. Module 7 (Contribution, real AI moderation via Claude, media upload pipeline, Admin Moderation Queue) was deliberately deferred by the project owner in favor of finishing Module 8's hardening pass — and, later, Phase 1.5's public web app — first; it remains the next module to build.

## Design Document Index (`/docs`)

| # | Document | Covers |
|---|---|---|
| 01 | [PRD MVP](docs/01-prd-mvp.md) | Executive summary, vision/mission/positioning, UVP, personas, problems, opportunities, competitive analysis, full MVP feature spec (purpose/actors/flows/business rules/validation/AC/risk per feature), out-of-scope, NFRs, business rules, assumptions, risks |
| 02 | [User Stories & Acceptance Criteria](docs/02-user-stories.md) | All MVP stories by epic (Auth, Map, Search, Detail, Reviews, Contribution, Media, Favorites, Admin, AI baseline), Given/When/Then AC, priority tags |
| 03 | [Sitemap & User Flows](docs/03-sitemap-userflow.md) | Full sitemap, 6 core user flow diagrams (first launch, guest auth-gate, write review, add restaurant, moderator workflow, AI NL search), navigation matrix |
| 04 | [Mobile Screen Specifications](docs/04-screen-list.md) | All 33 MVP screens (app + admin web), each with mục tiêu/UI/hành động/dữ liệu/loading/empty/error/validation/điều hướng |
| 05 | [System Architecture](docs/05-system-architecture.md) | Modular monolith rationale, module boundaries, AI Gateway design, moderation data flow, geospatial/search/caching strategy, deployment topology, extension points |
| 06 | [Database ERD](docs/06-database-erd.md) | Full entity model (34 entities) with fields, types, constraints, indexes, business rules, examples |
| 07 | [Tech Stack](docs/07-tech-stack.md) | React Native vs. Flutter decision, backend stack rationale (NestJS/PostgreSQL+PostGIS/Redis/BullMQ/R2/Claude API), rejected alternatives, cost posture |
| 08 | [Roadmap & Sprint Plan](docs/08-roadmap-sprint.md) | Phase 0-5 roadmap (goals/features/dependencies/risks/DoD/metrics per phase), detailed 8-sprint MVP plan with dependency chain |
| 09 | [Testing Strategy](docs/09-testing-plan.md) | Test pyramid + tooling per layer, automation priority list, security checklist, phase-based testing gates |
| 10 | [Portfolio Presentation Plan](docs/10-portfolio-presentation.md) | Demo data plan (30-50 seed restaurants), README structure, case study narrative, presentation assets checklist |

## Build Prompts (`/docs/build-prompts`)

Phase 1 (MVP) is broken into 8 sequential modules, each a self-contained prompt for a coding session, plus Module 9 for Phase 1.5 (added mid-project) — see [docs/build-prompts/00-how-to-use.md](docs/build-prompts/00-how-to-use.md) for how to run them in order:

1. [Foundations & Scaffolding](docs/build-prompts/01-foundations.md)
2. [Authentication & Profile](docs/build-prompts/02-auth.md)
3. [Map & Geospatial Core](docs/build-prompts/03-map-geospatial.md)
4. [Search & Filter](docs/build-prompts/04-search-filter.md)
5. [Restaurant Detail + Admin Seed Tooling](docs/build-prompts/05-restaurant-detail-admin-seed.md)
6. [Reviews & Composite Scoring](docs/build-prompts/06-reviews-scoring.md)
7. [Contribution, Media, AI Moderation & Moderation Queue](docs/build-prompts/07-contribution-media-moderation-ai.md) — **not started**
8. [Favorites, Notifications & Hardening](docs/build-prompts/08-favorites-notifications-polish.md)
9. [Public Web (Phase 1.5)](docs/build-prompts/09-public-web.md) — built ahead of Module 7

## Repository Structure

```text
/backend              NestJS API (modular monolith) — see docs/05-system-architecture.md
/mobile                React Native (Expo) consumer app
/admin-web              React (Vite) admin portal
/web                    Next.js public web app (Phase 1.5, SEO/discovery-focused)
/packages/shared-types  TypeScript types/DTOs shared across all four apps
/docs                   Full product & engineering design (Phase 0)
/docs/build-prompts      Per-module implementation prompts (Phase 1 + 1.5)
docker-compose.yml       Local Postgres+PostGIS and Redis
```

npm workspaces link the app/package folders together (root `package.json`) — install once from the repo root, not inside each app.

## Getting Started

Prerequisites: Node.js 20+, Docker Desktop.

```bash
# 1. Start local infra (Postgres+PostGIS, Redis)
docker compose up -d

# 2. Install all workspace dependencies (run once, from repo root)
npm install

# 3. Set up backend env vars — this sandbox blocks writing .env files directly,
#    so copy the template yourself:
cp backend/env.example backend/.env
cp mobile/env.example mobile/.env       # optional, defaults already point at localhost:3000
cp admin-web/env.example admin-web/.env # optional, same default
cp web/env.example web/.env.local       # optional, same default

# 4. Apply database migrations + seed data
cd backend
npx prisma migrate deploy
npx prisma generate
npm run seed                              # reference data: roles, categories, cuisines, price ranges, review criteria
npx ts-node prisma/seed-restaurants.ts    # the real 30-50 place HCMC demo dataset (docs/10-portfolio-presentation.md §2)
npx ts-node prisma/seed-reviews.ts        # 8-20 varied reviews per restaurant, feeds the composite-score job
cd ..

# 5. Run each app (separate terminals)
npm run dev:backend   # http://localhost:3000 — GET /health should return {status:"ok",db:true,redis:true}
npm run dev:admin     # http://localhost:5173
npm run dev:mobile    # Expo dev server (scan QR with Expo Go, or press i/a for simulator/emulator)
npm run dev:web       # http://localhost:3004 (backend already owns :3000)
```

Notifications have no real producer yet (that's Module 7's Admin Moderation Queue) — after registering an account in the app, seed yourself a few example notifications to see the Notifications screen populated: `cd backend && npx ts-node prisma/seed-notifications.ts your-registered-email@example.com`.

### Troubleshooting

- **`npm install` from inside a single app folder** (e.g. `cd admin-web && npm install`) instead of the repo root can leave a stray local `node_modules`/`package-lock.json` in that app, which duplicates `react`/`react-dom` outside the workspace's shared, deduped copy — the symptom is a blank white page with no visible error (two React instances loaded at once). Root `package.json` pins a single React version for the whole repo via `"overrides"` specifically to prevent this; if it ever recurs, delete the offending app's local `node_modules`/`package-lock.json` and re-run `npm install` from the repo root.
- **After deleting `node_modules` and reinstalling**, the backend's Prisma Client (generated code, not just a package) is wiped along with it — run `cd backend && npx prisma generate` again, or `tsc`/`nest build` will fail with `any`-typed Prisma calls.
- Always run `npm install` from the **repo root**, never from inside `backend/`, `mobile/`, or `admin-web/` individually.
- **Expo Go on iOS Simulator shows "There was a problem running the requested project. Could not connect to the server."** even though Metro is clearly running (`curl http://localhost:8081/status` succeeds): on this stack (Node 25+), Metro's dev server can end up bound to IPv6 loopback (`::1`) only, while Expo Go's simulator process connects via literal IPv4 (`127.0.0.1`) and gets a real TCP "connection refused" — not a firewall/VPN issue, confirmed via `xcrun simctl spawn <device> log stream` showing `SO_ERROR [61: Connection refused]` on the IPv4 attempt. Fixed by forcing Node's DNS resolution to prefer IPv4 first: `mobile/package.json`'s `start`/`ios`/`android` scripts already set `NODE_OPTIONS=--dns-result-order=ipv4first` for this reason — don't remove it, and if you ever bypass these scripts (e.g. run `npx expo start` directly), set that env var yourself.
- **No iOS Simulator boots at all** (`xcrun simctl list runtimes` is empty) — Xcode is installed but its iOS Simulator runtime isn't. Run `xcodebuild -downloadPlatform iOS` (~8.5GB download) once.
- **Backend restart seems to hang or silently keeps serving stale code** after `npm run start:dev` — check `lsof -nP -iTCP:3000 -sTCP:LISTEN` first. A previous `nest start --watch` process can survive a plain `pkill -f "nest start"` (e.g. if it was re-spawned by nodemon under a different parent), leaving an old build listening on 3000 while your new one fails silently with `EADDRINUSE` further down the log. Kill the exact PID `lsof` reports, confirm the port is free, then start fresh.
- **Rate-limited endpoints in automated tests/scripts**: `RateLimitGuard` keys by authenticated user (`request.user.id`) when a request is authenticated, falling back to IP(+email) only for pre-auth endpoints (login/register/forgot-password). If you add a new rate-limited authenticated endpoint, don't key it by IP alone — a shared IP-keyed bucket will throttle every user behind the same network (or every test run from the same machine) together. This exact bug was caught live during Module 8 (see `backend/src/modules/auth/guards/rate-limit.guard.ts`).
- **A void-returning endpoint's mutation silently "does nothing" in admin-web or mobile** (e.g. delete/suspend/reactivate/hide/restore succeeds server-side — check the DB — but the UI never reflects it, sometimes with a swallowed error): NestJS defaults a controller method that returns `Promise<void>` to a `200`/`201` status with an **empty body**, not `204`. Both `admin-web/src/api/client.ts` and `mobile/src/api/client.ts` only special-cased `status === 204` before calling `response.json()`, so an empty-bodied `200` threw a `SyntaxError` client-side — the request had already succeeded, but the calling mutation's `onSuccess` (and therefore its query-invalidation/refetch) never ran. Found live via the admin-web photo manager (delete appeared to do nothing, a newly-added photo didn't show up because the same crash blocked the post-add refetch too). Fixed on both ends: every void-returning controller method across the backend now has an explicit `@HttpCode(HttpStatus.NO_CONTENT)` (restaurant hide/restore/delete, menu-item delete, photo attach/delete, opening-hours/facilities replace, user suspend/reactivate/role-change, review delete — `user.controller.ts`'s `deleteAccount` already had it, which is what the others should have matched from the start), and both frontend clients now branch on the actual response body (`await response.text()`) rather than the status code, so a future endpoint that forgets the annotation degrades gracefully instead of crashing.
- **Backend returns 500s / `docker ps` shows `foodmap-postgres`/`foodmap-redis` as `Exited`**: Docker Desktop itself isn't running (common after a machine sleep/restart) — the containers didn't crash, the daemon that hosts them just isn't up. `open -a Docker`, wait for the daemon (`docker ps` stops erroring), then `docker start foodmap-postgres foodmap-redis`. Any backend process that was already running through the outage should be restarted too (see the stale-process entry above) rather than trusted to reconnect cleanly.
- **A `web/` page calls `notFound()` but the response is `200 OK` with 404-looking content (a "soft 404")**: this happens specifically on route segments that have a `loading.tsx` — Next's App Router wraps the page in a Suspense boundary for the skeleton, which forces the response shell to start streaming with a `200` status before the async page function reaches its `notFound()` call, and a streamed status code can't be changed after the fact. `web/src/app/restaurant/[slug]/` deliberately has **no** `loading.tsx` for this reason (the search page's `loading.tsx` is safe — that route never calls `notFound()`). Don't add a loading skeleton back to a route that can 404 without re-verifying the status code (`curl -o /dev/null -w '%{http_code}' <bad-slug-url>`) — a soft 404 is a real SEO regression on a site whose whole purpose is SEO.

Useful root-level scripts (run across every workspace): `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`.

Performance: `cd backend && npm run perf:nearby` / `perf:bounds` / `perf:search` runs k6 load tests against the three endpoints named in the testing plan (requires `brew install k6` and the backend running with the full seed dataset). See `backend/k6/README.md` for the last recorded results.

## Key Decisions at a Glance

- **Architecture:** modular monolith (NestJS), not microservices — see [05](docs/05-system-architecture.md)#1.
- **Mobile:** React Native + Expo, not Flutter — see [07](docs/07-tech-stack.md)#1.
- **Data:** PostgreSQL + PostGIS for both relational and geospatial needs; Postgres full-text/trigram search at MVP scale, not Elasticsearch — see [07](docs/07-tech-stack.md)#2.
- **AI:** Claude API behind a provider-agnostic `AIGateway`; never auto-approves high-risk content — see [05](docs/05-system-architecture.md)#4 and [01](docs/01-prd-mvp.md)#10.9. (Not built yet — Module 6 ships a rule-based moderation stand-in with the same state machine; Module 7 swaps in the real adapter.)
- **Scope discipline:** hard MVP boundary — no social feed, booking, payments, or ordering until Phase 2+ — see [01](docs/01-prd-mvp.md)#11 and [08](docs/08-roadmap-sprint.md).
- **Composite scoring:** Bayesian/IMDB-style damping toward a global prior mean so 2 five-star reviews can't outrank 50 reliable ones — see [01](docs/01-prd-mvp.md)#10.8, formula unit-tested in `backend/src/modules/review/composite-score.util.spec.ts`.
- **Public web (Phase 1.5):** a separate SEO-focused Next.js app (`web/`), server-rendered, read-only discovery surface (home/search/restaurant-detail + sitemap.xml/JSON-LD) — built ahead of Module 7 at the project owner's explicit direction, originally planned to wait until the full mobile MVP was done. See [07](docs/07-tech-stack.md)#5 and `docs/build-prompts/09-public-web.md`.

## Status

- [x] Phase 0 — Product Design (this document set)
- [~] Phase 1 — MVP implementation, 8 build-prompt modules in `docs/build-prompts/`:
  - [x] Module 1 — Foundations & Scaffolding
  - [x] Module 2 — Authentication & Profile
  - [x] Module 3 — Map & Geospatial Core
  - [x] Module 4 — Search & Filter
  - [x] Module 5 — Restaurant Detail + Admin Seed Tooling
  - [x] Module 6 — Reviews & Composite Scoring
  - [ ] Module 7 — Contribution, Media, AI Moderation & Moderation Queue *(deliberately deferred — see below)*
  - [x] Module 8 — Favorites, Notifications & Hardening *(built out of order — see below)*
- [x] Phase 1.5 — Public Web (Module 9, `web/`) *(built ahead of Module 7 — see below)*
- [ ] Phase 2 — Community
- [ ] Phase 3 — AI
- [ ] Phase 4 — Business
- [ ] Phase 5 — Monetization

### Module 8 notes (built ahead of Module 7)

Module 8 was completed before Module 7 at the project owner's explicit direction. Everything in its scope that doesn't depend on Module 7 is done and verified:

- **Favorites** — fully wired end-to-end (Detail, Search Result/List cards, Map marker preview, Favorites tab), instantly consistent across all four via a shared `useFavoriteIds()` cache.
- **Notifications** — real read/unread list + deep-linking; no producer exists yet (that's Module 7's Admin Moderation Queue), so `prisma/seed-notifications.ts` seeds a few example rows for your own test account in the meantime.
- **Settings** — dark mode (a real theme system: `mobile/src/theme/`, retrofitted across every screen, not just a toggle) + 2-step account deletion + logout.
- **Admin User Management gap-fix** — PRD §10.11 ("manage users (suspend/ban)") and the Security Checklist's "moderator blocked from role-change" item were never actually implemented by any earlier module; added now (`POST /admin/users/...`, API-only, no admin-web UI yet).
- **Security hardening** — full pass against the checklist in `docs/09-testing-plan.md` §4: SQL injection, JWT tampering (including `alg:none`), rate limiting (a real per-IP-vs-per-user bug was found and fixed), RBAC/IDOR, secrets-in-bundle, password-reset reuse. All verified against the running system, not just code review.
- **Performance** — k6 load tests against `/restaurants/nearby`, `/restaurants/bounds`, `/search`; all p95 <35ms against the full seed dataset (target: <500ms). See `backend/k6/README.md`.
- **Accessibility** — a real pass on the 5 primary flows (Login, Home Map, Search Result, Detail, Write Review): found and fixed a genuine WCAG AA contrast failure in the new dark-mode tokens, and added missing screen-reader labels/state (the star-rating picker in Write Review had zero accessible labels before this pass — the worst offender found).
- **Blocked on Module 7, not done**: the Security Checklist's file-upload-abuse item (no media pipeline exists yet), and the Demo Readiness checklist's demo video / deployed link / AI-Summary+Moderation-Queue screenshots (see `docs/10-portfolio-presentation.md` §5 — those two screens don't exist until Module 7 ships). These are re-flagged as pending, not silently skipped.

### Module 9 / Phase 1.5 notes (public web, built ahead of Module 7)

Also built at the project owner's explicit direction, ahead of the original dependency order (Phase 1.5 was originally planned to start only after the full mobile MVP, i.e. after Module 7/8). Scope per `docs/build-prompts/09-public-web.md`:

- **Next.js (App Router) app in `web/`** — server-rendered home, search/listing (`/search`), and restaurant detail (`/restaurant/[slug]`) pages, all fetching the existing backend read APIs directly (no new backend business logic, just two small additive endpoints — see below).
- **Real SEO artifacts, not just server rendering**: per-page `generateMetadata` (title/description/Open Graph), `schema.org/Restaurant` JSON-LD on every detail page (never fabricates `aggregateRating` when a restaurant has 0 reviews), `sitemap.xml` listing every published restaurant, `robots.txt`.
- **Backend additions** (small, additive, all covered by new e2e tests): `GET /restaurants/slug/:slug` (clean-URL lookup, mobile still uses id-based lookups unchanged) and `GET /restaurants/sitemap-index` (slug + updatedAt for every published restaurant). Also added `category`/`district` filters to `GET /search` — a real gap from Module 4 (only cuisine/facilities were filterable), needed to make the home page's category/district browse chips work, and `RestaurantSummaryDto` now carries `slug` (previously only on the detail DTO) so list/card UIs can link directly without a second round-trip.
- **Write actions are explicitly out of scope here**: no web login, no write-review form, no favorite button — an honest "use the mobile app" call-to-action appears where one of those would normally be, per the module's own scope boundary (see `docs/07-tech-stack.md` §5).
- Verified against the real seed dataset: server-rendered content confirmed via raw HTTP response (not just the browser-rendered DOM), including both a review-sparse and a photo/menu-sparse restaurant's honest empty states, `sitemap.xml` listing all 40 restaurants, and a production `next build` succeeding with no type errors.
- **Completeness pass (after the initial build)**: the search page's filter chips became a real interactive `SearchFilterForm` (category/district/cuisine/facilities/price/openNow, `'use client'` only for the filter controls — results stay server-rendered); generated favicon/apple-icon (`next/og`) + `viewport`/`theme-color`; detail-page photos moved to `next/image`; a `loading.tsx` skeleton for `/search` (not for the detail page — see the Troubleshooting entry on soft 404s above); a global `error.tsx` boundary; breadcrumb nav + `BreadcrumbList` JSON-LD and paginated reviews on the detail page; an accessibility pass (skip-link, landmark `aria-label`s, `:focus-visible`, `sr-only` table caption, decorative-emoji `aria-hidden`) that also caught a real WCAG AA contrast failure — white text on `--color-primary` (#e4572e) computes to ~3.7:1, below the 4.5:1 normal-text threshold; buttons/selected-chips now use `--color-primary-dark` (~4.9:1) instead.
- **Real thumbnails wired up everywhere, not just Favorites**: `RestaurantSummaryDto.thumbnailUrl` had a working implementation in `favorite.service.ts` (first photo per restaurant from the `photos` table) but `search.service.ts` and `restaurant.service.ts`'s map-viewport queries still hard-coded `thumbnailUrl: null`, and *no* card component (web or mobile) ever rendered it even when present — every list/map view showed a 🍽️ emoji placeholder regardless of whether real photos existed. This was never blocked by Module 7 (the media *upload* pipeline) — seed data already populates the `photos` table. Fixed: both backend hydrators now batch-fetch each restaurant's first photo (same pattern as Favorites), and `RestaurantCard` (web + mobile) and mobile's map `RestaurantPreviewCard` render the real photo via `next/image`/`Image` when `thumbnailUrl` is set, falling back to the emoji only for restaurants with zero photos.
- **Not done**: no deployment (local dev only — see Module 8's notes above on the same gap), no visual/design polish pass beyond functional plain CSS, no automated tests for the web app itself (verification so far is manual/curl-based against the real running stack, mirroring how earlier modules were verified before their own test suites were written).
