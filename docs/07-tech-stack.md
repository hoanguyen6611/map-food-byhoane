# Technology Stack & Rationale

## 1. Mobile: React Native vs. Flutter

| Criteria | React Native (+ Expo) | Flutter |
|---|---|---|
| Dev speed (solo/small team) | Very high — JS/TS, huge Stack Overflow/AI-assist coverage, Expo removes native tooling pain | High, but Dart has a smaller talent pool and less AI/community coverage for niche issues |
| Maintainability | Good, if discipline enforced (TS, lint, folder structure) | Good, arguably more consistent UI by default (single rendering engine) |
| Performance | Good enough for a maps/list/media app; not GPU-bound like a game | Slightly better raw UI performance (own rendering engine, no JS bridge) — not decisive for this app's profile |
| Map integration | `react-native-maps` (Google Maps/Apple Maps native wrappers) — mature, widely used, good clustering libraries (`react-native-map-clustering`) | `google_maps_flutter` — mature too, clustering less battle-tested |
| GPS/location | `expo-location` / `react-native-geolocation` — mature | `geolocator` — mature |
| Media upload (camera/picker/compression) | `expo-image-picker`, `expo-camera`, `expo-image-manipulator` — first-class, well-integrated | `image_picker`, `camera`, needs more manual compression wiring |
| Push notifications | `expo-notifications` unifies FCM/APNs setup dramatically | `firebase_messaging` — solid but more manual native config |
| Build/release pipeline | **EAS Build/Submit** — cloud build for both platforms without owning a Mac for iOS builds; critical for a solo dev without constant Xcode access | Flutter has `flutter build` but iOS still needs a Mac (or CI Mac runner) with more manual signing setup |
| Ecosystem breadth for a "long tail" feature app (deep links, in-app purchase later, ad SDKs later) | Extremely broad (npm) | Broad, but noticeably thinner for niche/regional (Vietnam-specific SDKs, e.g. VNPay/Momo, are more often JS-first) |
| Long-term scalability | Proven at scale (Instagram, Discord, Shopify) | Proven at scale (Google Pay, BMW) — both are valid at scale |
| Code sharing with future web/admin | High — same language (TS) as the NestJS backend and a future web app, shared types/DTOs possible | Low — Dart doesn't share with a TS backend/admin web |

**Decision: React Native, using Expo (managed workflow, "prebuild" eject available if a native module ever demands it).**

**Why this wins for this specific project:**
1. **Single-language coherence**: Backend is TypeScript (NestJS, see §2). Sharing DTO types/interfaces between mobile and backend (via a shared `types` package) is a real, compounding maintainability win a Dart mobile app can't get.
2. **Solo-dev build pipeline**: EAS Build/Submit means shipping an iOS TestFlight build without owning a Mac full-time — directly relevant for a portfolio project built by one person.
3. **Vietnam-market future-proofing**: when Phase 5 monetization (VNPay/Momo, Vietnamese ad networks) becomes relevant, the JS ecosystem has first-party or better-maintained SDKs more often than Dart's.
4. **This app's UI is list/card/map/form-heavy, not animation/game-heavy** — the area where Flutter's custom-renderer performance edge would actually matter is not this app's bottleneck. The bottleneck is marker clustering and viewport queries, which both frameworks handle adequately via native map SDKks.

**Trade-off accepted:** Flutter's single-rendering-engine consistency (no JS-bridge-adjacent quirks) is a real minor advantage; it's outweighed here by ecosystem/pipeline/team-of-one factors.

## 2. Backend

| Layer | Choice | Why |
|---|---|---|
| Runtime/Framework | **Node.js + NestJS (TypeScript)** | Opinionated module system maps directly onto the modular-monolith domain boundaries in [05-system-architecture.md](05-system-architecture.md); DI + decorators make RBAC guards, validation pipes, and interceptors (logging/audit) consistent across ~10 modules without reinventing structure. Shares TS with the RN app. |
| Primary datastore | **PostgreSQL + PostGIS** | One database for relational + geospatial needs; `ST_DWithin`/GIST index gives production-grade "nearby search" without a second datastore. Free/cheap managed options exist (Neon, Supabase, Railway). |
| Search (MVP) | **PostgreSQL `pg_trgm` + `unaccent` + `tsvector`** | Handles Vietnamese diacritics-insensitive fuzzy search at MVP data volume (tens to low-thousands of rows) with zero extra infrastructure. **V2 trigger to introduce OpenSearch:** catalog exceeds ~50k restaurants, or query patterns need faceted aggregation/typo-tolerant NL search at scale Postgres can't serve within the performance budget. |
| Cache / rate-limit / queue backing | **Redis** | Viewport cache, auth rate-limiting sliding windows, and BullMQ's queue backend — one piece of infra serving three needs. Cheap managed tier (Upstash) fits MVP budget. |
| Background jobs | **BullMQ** | Composite score recomputation, AI moderation calls, AI summary generation, notification dispatch — all async, all need retry/backoff, which BullMQ provides natively on top of Redis already in the stack. |
| Object storage | **S3-compatible (Cloudflare R2 preferred)** | R2 has zero egress fees, which matters for an image-heavy food app; API-compatible with AWS S3 SDKs so no lock-in to a specific provider. |
| CDN | **Cloudflare CDN in front of R2** | Free tier covers portfolio-scale traffic; images/thumbnails cached at edge. |
| Auth | **JWT (access, 15 min) + refresh token (7–30 days, rotated, stored hashed)** via NestJS Passport strategies + Google/Apple OAuth strategies | Stateless access tokens keep the API horizontally scalable later; refresh rotation limits replay risk. Session-based auth was considered but adds sticky-session/shared-store complexity RN clients don't need. |
| AI provider | **Claude API (Anthropic), via an internal `AIGateway` interface** (see architecture doc §4) | Strong structured-output reliability (tool use / JSON mode) for moderation scoring and NL query parsing; strong Vietnamese-language comprehension for summarization; abstraction layer means swapping providers later is a config change, not a rewrite. |
| Admin Portal frontend | **React (Vite) + a component library (e.g., shadcn/ui or Ant Design)**, NOT React Native | Admin is a desktop-first, dense-data, form-heavy tool — a web SPA is the right tool; reuses TS types from the shared package too. |

### Why NOT the alternatives considered

- **Firebase/Supabase as the *entire* backend:** rejected as the primary datastore because PostGIS-grade geospatial querying and a fully custom moderation/RBAC domain model are awkward to express in Firestore's document model or Supabase's more limited geo tooling versus a hand-modeled Postgres schema with PostGIS. Supabase Storage/Auth *could* substitute for pieces (object storage, auth) to cut ops further — noted as a valid cost-optimization swap in the DevOps doc, but the domain/business-logic layer stays a NestJS service regardless.
- **Elasticsearch/OpenSearch on day one:** rejected per the explicit "no over-engineering" project rule — a second stateful service to operate for a 30–50 row seed dataset has negative ROI at this stage.
- **Microservices:** rejected — see [05-system-architecture.md](05-system-architecture.md) §1 for the full comparison.
- **GraphQL:** REST chosen over GraphQL — the domain has well-defined, mostly-flat resource shapes (restaurant detail, search results) where GraphQL's main benefit (avoiding over/under-fetching across deeply nested graphs) doesn't pay for the added server complexity (resolver N+1 management, schema tooling) at this stage. REST + OpenAPI gives free client SDK generation for both RN and the admin web app.

## 3. Confirmed Stack Summary

```
Mobile:        React Native (Expo) + TypeScript + react-native-maps + Zustand/React Query
Admin Web:     React (Vite) + TypeScript + React Query
Backend:       NestJS (Node.js/TypeScript), modular monolith
Database:      PostgreSQL 15+ with PostGIS, pg_trgm, unaccent
Cache/Queue:   Redis + BullMQ
Object Store:  Cloudflare R2 (S3-compatible) + Cloudflare CDN
Auth:          JWT access/refresh + Google/Apple OAuth (Passport strategies)
AI:            Claude API via internal AIGateway abstraction
Infra:         Docker containers, single ap-southeast region, managed Postgres/Redis
CI/CD:         GitHub Actions + EAS Build/Submit (mobile), Docker image deploy (backend)
```

## 4. Cost Posture (MVP, indicative monthly, portfolio-scale traffic)

| Item | Option | Est. cost |
|---|---|---|
| Postgres + PostGIS | Neon/Supabase free-to-low tier | $0–25 |
| Redis | Upstash free tier | $0 |
| Object storage + CDN | Cloudflare R2 + CDN | $0–5 (R2 free egress) |
| Backend hosting | Railway/Render/Fly.io single instance | $5–20 |
| AI API calls | Claude API, usage-based, cached aggressively | $5–30 depending on demo traffic |
| Mobile builds | EAS Build free tier (limited builds/month) | $0 |
| **Total** | | **≈ $10–80/month**, scalable up only when real usage demands it |

This is deliberately over-provisioned toward "cheap and swappable" rather than "maximally scalable," per the project rule to balance portfolio quality against real deployability.

## 5. Public Web App (Post-MVP Phase — decided during the Module 5→6 transition)

The MVP (§Phase 1 in [08-roadmap-sprint.md](08-roadmap-sprint.md)) is mobile-only, per the PRD's "mobile-first" positioning ([01-prd-mvp.md](01-prd-mvp.md) §1). A public, end-user-facing web app was added to scope as a **follow-on phase after Phase 1 (mobile MVP) completes** — see [08-roadmap-sprint.md](08-roadmap-sprint.md) §1 "Phase 1.5 — Public Web".

**Decision: Next.js (App Router) + TypeScript, SSR/SSG-first.**

**Why:** the stated goal for this web app is SEO/discovery — Google-indexable restaurant detail and search/listing pages that give the product an acquisition channel the mobile app structurally cannot have (app stores don't get organically crawled per-restaurant). That requires content to be present in the initial server-rendered HTML, which rules out a client-only SPA (the existing admin-web Vite+React pattern is right for a logged-in internal tool, wrong here). Next.js was chosen over a custom SSR setup because it's the default, well-supported choice for this exact "public marketing/content site with some dynamic data" shape, and because the team already has React/TypeScript fluency from mobile + admin-web — no new language, only a new rendering model to learn.

**Scope boundary (explicit, to avoid quietly re-scoping into "rebuild the whole app twice"):** SEO/discovery-first means map + search + restaurant detail pages are the core surface, server-rendered and indexable. Auth-gated write actions (write a review, favorite, add a restaurant) either deep-link/redirect into the mobile app or get a minimal web implementation — exact cutoff is a call for whoever scopes that phase's build-prompt module, not decided here. Full feature parity with mobile was explicitly considered and rejected for the initial cut (would double UI-maintenance surface for a benefit — a place to do everything the app already does — that isn't the reason this phase exists).

**Code sharing:** `packages/shared-types` (already used by backend/mobile/admin-web) extends the same way to the new `web/` workspace — no new cross-package typing work needed, same monorepo pattern.

```
Public Web:    Next.js (App Router) + TypeScript + @foodmap/shared-types (SSR/SSG, SEO-first)
```
