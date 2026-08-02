# Module 3 — Map & Geospatial Core

## Context

Modules 1-2 done: scaffolding + working auth. This module makes the app show restaurants on a map for the first time — no restaurants exist yet except whatever you insert manually for testing (real seeding is Module 5's job). Read before starting:
- `docs/01-prd-mvp.md` §10.2 (Map & GPS feature spec).
- `docs/02-user-stories.md` Epic B (US-B1–B4).
- `docs/06-database-erd.md` §3 `Location` entity — the PostGIS geography column and GIST index already exist from Module 1's migrations; this module is the first to query them.
- `docs/05-system-architecture.md` §6 (Geospatial Query Path) and §8 (Caching Strategy, viewport row) — implement exactly this caching approach.
- `docs/04-screen-list.md` screen 7 (Home Map).

## Scope

### Backend — `RestaurantModule` (read paths only) + `SearchModule` scaffolding
- `GET /restaurants/nearby?lat=&lng=&radiusKm=` — `ST_DWithin` query against `Location.geoPoint`, radius capped server-side at 20km regardless of requested value, default 3km if omitted. Returns restaurant summary shape (id, name, thumbnail, rating placeholder — real composite score arrives in Module 6, so return `null`/`0` with `reviewCount: 0` honestly for now, price range, distance in meters, open-now boolean computed from `OpeningHour` — implement `OpeningHour` read logic now even though the write/admin side of hours comes in Module 5).
- `GET /restaurants/bounds?swLat=&swLng=&neLat=&neLng=` — bounding-box query using `ST_MakeEnvelope` + `&&` for viewport-based map queries; cap max returned markers at 200 (per PRD business rule), prioritized by whatever proxy for quality exists at this point (recency is fine until Module 6 adds real scoring).
- Redis caching: cache viewport query results keyed by rounded bounds + any active filter hash, 30-60s TTL, per architecture doc §8. Implement cache invalidation stub (even if nothing invalidates it yet, since no writes exist in this module) — document that Module 5's Restaurant CRUD must invalidate this cache on writes.
- Basic marker clustering can be done client-side (see Mobile section) OR you may pre-aggregate clusters server-side at low zoom levels if client-side clustering proves insufficient for performance — default to client-side first since it's simpler and the seed dataset is small.

### Mobile — Home Map (screen 7)
- Integrate `react-native-maps` with `react-native-map-clustering` (or equivalent) per the tech stack decision.
- Request location permission with the rationale-first UX described in `docs/04-screen-list.md` screen 3 (Permission Location) — build the real permission flow now (Module 1 only stubbed the screen).
- On permission denied: fall back to a default city center (use Ho Chi Minh City center coordinates) + a dismissible banner offering "chọn khu vực thủ công" — a simple city/district picker is sufficient for MVP, does not need to be a full geocoding search yet (that arrives in Module 4/5's location picker).
- Debounce viewport-change events (≥500ms per PRD) before calling `/restaurants/bounds`; do not fire a request per animation frame.
- Marker tap → bottom sheet preview card (per US-B4: name, thumbnail, rating placeholder, price range, distance, open/closed badge) with a button that would navigate to Restaurant Detail — Detail itself doesn't exist yet until Module 5, so navigate to a placeholder screen that just shows the restaurant ID for now, or skip the navigation call and leave a TODO comment referencing Module 5.
- Handle empty state (no restaurants in viewport) and error state (network failure, cached data shown with a stale-data banner) per the screen spec.

### Manual test data
Since no Add Restaurant flow exists yet, write a small script or use direct DB inserts to place 5-10 test restaurants with valid `Location`/`Address`/`OpeningHour` rows around a real Ho Chi Minh City area, so the map has something real to render and cluster. This is throwaway test data, not the real seed dataset (that's Module 5's `docs/10-portfolio-presentation.md` Demo Data Plan).

## Explicitly out of scope
No search bar functionality yet (Module 4), no restaurant detail screen (Module 5), no add-restaurant FAB action wired to a real flow (Module 7), no real composite scoring (Module 6).

## Definition of Done
Verify against `docs/02-user-stories.md` Epic B:
- [ ] US-B1–B4 pass manually on a simulator/emulator with location permission both granted and denied.
- [ ] Panning/zooming the map triggers debounced refetches, verified by logging/network-inspecting that rapid pans don't fire a request per frame.
- [ ] Clustering visually splits correctly when zooming into a dense cluster.
- [ ] `/restaurants/nearby` and `/restaurants/bounds` have API tests covering: valid query, radius cap enforcement (requesting 50km returns data capped to 20km behavior), and empty-result response shape.
- [ ] Map first paint measured under 2s on a throttled connection profile against the test dataset.
