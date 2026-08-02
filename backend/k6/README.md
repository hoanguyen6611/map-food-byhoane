# Performance tests (docs/09-testing-plan.md §1, docs/build-prompts/08)

k6 load scripts against the three endpoints named in the testing plan:
`/restaurants/nearby`, `/restaurants/bounds`, `/search`. Each asserts the
NFR target from `docs/01-prd-mvp.md` §13 — **p95 < 500ms** for read
endpoints — via a k6 threshold, so a failing run exits non-zero.

## Prerequisites

- Backend running locally (`npm run start:dev`) against the real seed
  dataset (`prisma/seed-restaurants.ts` + `prisma/seed-reviews.ts` already
  run — 40 restaurants, 471 reviews).
- k6 installed (`brew install k6`).

## Running

```bash
k6 run k6/nearby.js
k6 run k6/bounds.js
k6 run k6/search.js

# Or against a different host:
BASE_URL=https://staging.example.com k6 run k6/nearby.js
```

Each script runs 20 constant VUs for 30s against realistic, varied query
shapes (jittered coordinates/viewports, a mix of text search / browse /
combined-filter queries) — not the same cached request repeated, which
would understate real p95.

## Last results (2026-08-02, local dev, 40 restaurants / 471 reviews)

| Endpoint | p95 | Target | Result |
|---|---|---|---|
| `/restaurants/nearby` | 24.9ms | <500ms | ✅ |
| `/restaurants/bounds` | 31.2ms | <500ms | ✅ |
| `/search` | 32.4ms | <500ms | ✅ |

All three comfortably meet the NFR target at seed-scale data with 0%
request failure — no profiling/index work was needed. Re-run and update this
table if the seed dataset size changes materially (e.g. before a real
demo/deployment) or if new indexes/queries are added to these paths.
