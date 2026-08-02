# How to Use These Build Prompts

This folder breaks Phase 1 (MVP) implementation into 8 sequential modules, mirroring the sprint plan in [../08-roadmap-sprint.md](../08-roadmap-sprint.md). Each module has its own file with a **self-contained prompt** you can paste into a fresh Claude Code session (or hand to any coding agent) to implement that slice.

## Why split this way

- Each module produces a **working, testable increment** — never "half a feature."
- Modules are ordered by dependency (see the chain in the roadmap doc): you cannot build Search before Map exists, cannot build Reviews before Auth exists, etc.
- Splitting keeps each coding session focused on one bounded context, which keeps generated code coherent and reviewable — matching this project's "modular monolith" architecture rather than asking one session to sprawl across the whole system.

## How to run a module

1. Open a new session in this repo (or continue the same one — context carries over either way since `/docs` is already on disk).
2. Paste the entire contents of the module file (e.g. `01-foundations.md`) as your prompt.
3. Let the agent implement, then **actually run it** (start the backend, run the RN app, hit the endpoints) before moving to the next module — every module file ends with a concrete "Definition of Done" checklist to verify against.
4. Only proceed to the next module once the current one's Definition of Done passes. Do not let module N+1 start against a broken module N.

## Module order

| # | File | Sprint (from roadmap) | Produces |
|---|---|---|---|
| 1 | [01-foundations.md](01-foundations.md) | S1 | Repo scaffolding, Docker Compose, DB migrations for Identity + Restaurant Core |
| 2 | [02-auth.md](02-auth.md) | S2 | Auth module (backend) + auth screens (mobile) |
| 3 | [03-map-geospatial.md](03-map-geospatial.md) | S3 | Nearby/bounds APIs + Home Map with clustering |
| 4 | [04-search-filter.md](04-search-filter.md) | S4 | Search/filter APIs + Search/Filter/Home List screens |
| 5 | [05-restaurant-detail-admin-seed.md](05-restaurant-detail-admin-seed.md) | S5 | Detail API/screens + Admin Restaurant Management + seed script |
| 6 | [06-reviews-scoring.md](06-reviews-scoring.md) | S6 | Review module + composite scoring job + review screens |
| 7 | [07-contribution-media-moderation-ai.md](07-contribution-media-moderation-ai.md) | S7 | Add Restaurant, media upload, AI moderation pipeline, Admin Moderation Queue |
| 8 | [08-favorites-notifications-polish.md](08-favorites-notifications-polish.md) | S8 | Favorites, notifications, security/perf hardening, demo readiness |

## Conventions every module prompt assumes

- All product/business rules come from `/docs` — the module prompt tells the agent which specific doc sections to read, never restates the entire PRD inline (avoids drift between the source of truth and the prompt).
- Stack is locked: NestJS (TS) backend, PostgreSQL+PostGIS, Redis, React Native+Expo mobile, React(Vite) admin web — see [../07-tech-stack.md](../07-tech-stack.md). A module prompt should never re-litigate this.
- Every module includes backend + relevant mobile/admin screens together, not backend-only then frontend-only passes — this matches how the sprints are scoped and avoids building APIs no screen ever calls (or screens with no API to call).
