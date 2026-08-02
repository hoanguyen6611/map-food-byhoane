# Module 4 — Search & Filter

## Context

Modules 1-3 done: auth works, the map shows test restaurants. This module adds intentional discovery (typing/filtering) on top of passive map browsing. Read before starting:
- `docs/01-prd-mvp.md` §10.3 (Search & Filter feature spec).
- `docs/02-user-stories.md` Epic C (US-C1–C4).
- `docs/05-system-architecture.md` §7 (Search Path — Postgres `pg_trgm`/`unaccent`/`tsvector`, explicitly not Elasticsearch at this stage).
- `docs/04-screen-list.md` screens 8-11 (Home List, Search, Search Result, Filter).

## Scope

### Backend — `SearchModule`
- Migration: add a generated `tsvector` column on `Restaurant` combining `name` + `description` (+ joined `Dish.name`/`aliasKeywords` for dish-based matching), with `unaccent()` applied so "com tam" matches "cơm tấm". Add a GIN index on it (complementing the trigram index from Module 1).
- `GET /search?q=&lat=&lng=&distanceKm=&priceMin=&priceMax=&minRating=&openNow=&facilities=&cuisine=` — combines full-text/trigram relevance ranking with the geospatial nearby logic from Module 3, applies all provided filters as AND conditions, returns paginated results sorted by a relevance blend (for now: text-match rank + distance; real composite-score weighting arrives once Module 6 exists — leave a clearly marked `// TODO Module 6: fold compositeScore into ranking` comment).
- Validate filter inputs per PRD business rules: `priceMin <= priceMax`, `distanceKm` capped at 20km, `openNow` computed against `OpeningHour` + `Asia/Ho_Chi_Minh` timezone (handle overnight hours correctly — a place open 18:00–02:00 must show as open at 00:30).
- `GET /restaurants?<same filter params, no q>` — the "browse with filters, no search text" path used by Home List.
- Persist each search to `SearchHistory` (nullable `userId` for guest, or a client-supplied `deviceId` header) — no read API for this yet, it's write-only in MVP (feeds V2 personalization per the roadmap doc), but the table must be populated from day one so historical data exists when V2 needs it.

### Mobile — Search, Search Result, Filter, Home List (screens 8-11)
- Search screen: input with 300ms debounce, recent-searches list (client-cached from `SearchHistory`-adjacent local storage, last 5 unique queries), default popular-query suggestions when empty.
- Filter screen: bottom sheet with distance slider, price range (VND, matching `PriceRange` buckets from the ERD), minimum rating, open-now switch, facility multi-select chips (from `RestaurantFacility` enum), cuisine multi-select chips. "Xoá bộ lọc" and "Áp dụng" actions. Filter state persists across navigation (don't reset when the user backs out to Search Result and returns).
- Search Result + Home List: reuse the `RestaurantCard` component (define it now if Module 3 didn't already factor one out of the map preview — this becomes the single shared card component every later screen reuses).
- Empty state ("no results, relax your filters" + nearby alternatives) and error state (toast + retry) per the screen spec.

## Explicitly out of scope
No AI-powered natural-language query parsing yet (that's the NL-to-filter layer described in `docs/03-sitemap-userflow.md` §2.6 — it depends on the `AIGateway`, which arrives in Module 7; a plain keyword search is the whole scope here). No restaurant detail navigation target beyond what Module 3 already stubbed.

## Definition of Done
Verify against `docs/02-user-stories.md` Epic C and `docs/09-testing-plan.md` automation priorities #2-3:
- [ ] US-C1–C4 pass manually.
- [ ] Automated test: "com tam" (no diacritics) matches a seeded "cơm tấm" restaurant/dish.
- [ ] Automated test: combining distance + price + open-now filters returns only results satisfying all three (not OR logic).
- [ ] Automated test: `priceMin > priceMax` is rejected with a validation error, not silently ignored.
- [ ] Filtering p95 latency measured under 500ms against the test dataset from Module 3 (a proper load test against realistic volume happens in Module 8/DevOps, this is just a sanity check now).
- [ ] Applied filters visibly persist when navigating Search Result → Detail-placeholder → back.
