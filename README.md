# The Food Map of Vietnam

> Nền tảng bản đồ ẩm thực thông minh được xây dựng bởi cộng đồng và AI — không chỉ giúp bạn tìm quán gần nhất, mà giúp bạn tìm đúng quán phù hợp nhất.

This repository holds the full design (`/docs`) and the in-progress implementation for The Food Map of Vietnam: a Vietnam-first food & beverage discovery platform combining a specialized map, structured community reviews, and an explainable AI recommendation layer. It is built as a portfolio project with the architecture and product rigor of a real, fundable product.

**Current status: Modules 1-4 complete.** Foundations (repo structure, Docker Compose, database schema/migrations), full Authentication & Profile (register/login/OAuth-ready/refresh-rotation/forgot-reset password, RBAC guards, rate limiting, mobile auth screens + secure token storage, Admin Portal login with role gating), Map & Geospatial Core (PostGIS nearby/bounds search with Redis viewport caching, real Vietnam-timezone open-now computation, real-device-tested React Native map with clustering, permission/GPS fallback, marker preview), and Search & Filter (diacritics-insensitive full-text + trigram + dish-name search, combined AND filters for distance/price/rating/open-now/facilities/cuisine, paginated Search Result & Home List screens with a shared RestaurantCard and a persistent filter store) are implemented and verified working — see [Getting Started](#getting-started) to run it, and [Status](#status) for what's next.

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

Implementation is broken into 8 sequential modules, each a self-contained prompt for a coding session — see [docs/build-prompts/00-how-to-use.md](docs/build-prompts/00-how-to-use.md) for how to run them in order:

1. [Foundations & Scaffolding](docs/build-prompts/01-foundations.md)
2. [Authentication & Profile](docs/build-prompts/02-auth.md)
3. [Map & Geospatial Core](docs/build-prompts/03-map-geospatial.md)
4. [Search & Filter](docs/build-prompts/04-search-filter.md)
5. [Restaurant Detail + Admin Seed Tooling](docs/build-prompts/05-restaurant-detail-admin-seed.md)
6. [Reviews & Composite Scoring](docs/build-prompts/06-reviews-scoring.md)
7. [Contribution, Media, AI Moderation & Moderation Queue](docs/build-prompts/07-contribution-media-moderation-ai.md)
8. [Favorites, Notifications & Hardening](docs/build-prompts/08-favorites-notifications-polish.md)

## Repository Structure

```text
/backend              NestJS API (modular monolith) — see docs/05-system-architecture.md
/mobile                React Native (Expo) consumer app
/admin-web              React (Vite) admin portal
/packages/shared-types  TypeScript types/DTOs shared across all three apps
/docs                   Full product & engineering design (Phase 0)
/docs/build-prompts      Per-module implementation prompts (Phase 1)
docker-compose.yml       Local Postgres+PostGIS and Redis
```

npm workspaces link the four app/package folders together (root `package.json`) — install once from the repo root, not inside each app.

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

# 4. Apply database migrations + seed reference data (roles, categories, cuisines, price ranges)
cd backend
npx prisma migrate deploy
npx prisma generate
npm run seed
cd ..

# 5. Run each app (separate terminals)
npm run dev:backend   # http://localhost:3000 — GET /health should return {status:"ok",db:true,redis:true}
npm run dev:admin     # http://localhost:5173
npm run dev:mobile    # Expo dev server (scan QR with Expo Go, or press i/a for simulator/emulator)
```

### Troubleshooting

- **`npm install` from inside a single app folder** (e.g. `cd admin-web && npm install`) instead of the repo root can leave a stray local `node_modules`/`package-lock.json` in that app, which duplicates `react`/`react-dom` outside the workspace's shared, deduped copy — the symptom is a blank white page with no visible error (two React instances loaded at once). Root `package.json` pins a single React version for the whole repo via `"overrides"` specifically to prevent this; if it ever recurs, delete the offending app's local `node_modules`/`package-lock.json` and re-run `npm install` from the repo root.
- **After deleting `node_modules` and reinstalling**, the backend's Prisma Client (generated code, not just a package) is wiped along with it — run `cd backend && npx prisma generate` again, or `tsc`/`nest build` will fail with `any`-typed Prisma calls.
- Always run `npm install` from the **repo root**, never from inside `backend/`, `mobile/`, or `admin-web/` individually.
- **Expo Go on iOS Simulator shows "There was a problem running the requested project. Could not connect to the server."** even though Metro is clearly running (`curl http://localhost:8081/status` succeeds): on this stack (Node 25+), Metro's dev server can end up bound to IPv6 loopback (`::1`) only, while Expo Go's simulator process connects via literal IPv4 (`127.0.0.1`) and gets a real TCP "connection refused" — not a firewall/VPN issue, confirmed via `xcrun simctl spawn <device> log stream` showing `SO_ERROR [61: Connection refused]` on the IPv4 attempt. Fixed by forcing Node's DNS resolution to prefer IPv4 first: `mobile/package.json`'s `start`/`ios`/`android` scripts already set `NODE_OPTIONS=--dns-result-order=ipv4first` for this reason — don't remove it, and if you ever bypass these scripts (e.g. run `npx expo start` directly), set that env var yourself.
- **No iOS Simulator boots at all** (`xcrun simctl list runtimes` is empty) — Xcode is installed but its iOS Simulator runtime isn't. Run `xcodebuild -downloadPlatform iOS` (~8.5GB download) once.

Useful root-level scripts (run across every workspace): `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`.

## Key Decisions at a Glance

- **Architecture:** modular monolith (NestJS), not microservices — see [05](docs/05-system-architecture.md)#1.
- **Mobile:** React Native + Expo, not Flutter — see [07](docs/07-tech-stack.md)#1.
- **Data:** PostgreSQL + PostGIS for both relational and geospatial needs; Postgres full-text/trigram search at MVP scale, not Elasticsearch — see [07](docs/07-tech-stack.md)#2.
- **AI:** Claude API behind a provider-agnostic `AIGateway`; never auto-approves high-risk content — see [05](docs/05-system-architecture.md)#4 and [01](docs/01-prd-mvp.md)#10.9.
- **Scope discipline:** hard MVP boundary — no social feed, booking, payments, or ordering until Phase 2+ — see [01](docs/01-prd-mvp.md)#11 and [08](docs/08-roadmap-sprint.md).

## Status

- [x] Phase 0 — Product Design (this document set)
- [~] Phase 1 — MVP implementation, 8 build-prompt modules in `docs/build-prompts/`:
  - [x] Module 1 — Foundations & Scaffolding
  - [x] Module 2 — Authentication & Profile
  - [x] Module 3 — Map & Geospatial Core
  - [x] Module 4 — Search & Filter
  - [x] Module 5 — Restaurant Detail + Admin Seed Tooling
  - [ ] Module 6 — Reviews & Composite Scoring
  - [ ] Module 7 — Contribution, Media, AI Moderation & Moderation Queue
  - [ ] Module 8 — Favorites, Notifications & Hardening
- [ ] Phase 2 — Community
- [ ] Phase 3 — AI
- [ ] Phase 4 — Business
- [ ] Phase 5 — Monetization
