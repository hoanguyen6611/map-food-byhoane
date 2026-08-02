# Module 5 — Restaurant Detail + Admin Restaurant Management + Seed Data

## Context

Modules 1-4 done: map + search/filter work against test data. This module does three things together because they're tightly coupled: (1) the full Detail screen, which needs real data to look good, (2) the Admin CRUD tooling to create that real data, and (3) actually running the seed to produce the 30-50 demo restaurants everything after this module will look believable against. Read before starting:
- `docs/01-prd-mvp.md` §10.4 (Restaurant Detail feature spec).
- `docs/02-user-stories.md` Epic D (US-D1–D3) and Epic I stories US-I1, US-I5 (admin CRUD + audit logging).
- `docs/04-screen-list.md` screens 12-15 (Restaurant Card, Restaurant Detail, Photo Gallery, Menu) and screen 30 (Admin Restaurant Management).
- `docs/06-database-erd.md` full §3 (Restaurant Core) and §4 (Photo/Video — you only need `Photo` here, `Video` schema exists but upload UI is V1 per the PRD, skip it).
- `docs/10-portfolio-presentation.md` §2 (Demo Data Plan) — this defines exactly what the seed dataset must look like.
- `docs/05-system-architecture.md` §10 — note `AuditLog` is expected on every admin mutation from this module onward.

## Scope

### Backend — `RestaurantModule` (write paths) + `AdminModule` foundation
- `GET /restaurants/:id` — full aggregated detail payload: core fields, `Address`, `Location`, `OpeningHour[]` (with open-now computed), `Menu`+`MenuItem[]`, `Photo[]`, `RestaurantFacility[]`. Leave `reviews`/`aiSummary` fields in the response shape but populate them as empty/null — Module 6 and Module 7 fill those in without changing this contract.
- Admin-only CRUD: `POST/PATCH/DELETE /admin/restaurants`, plus nested menu/hours/facility management endpoints. Every mutation must write an `AuditLog` row (actorId, action, before/after state) — implement this as a shared interceptor/decorator now since every later admin module (Review Management, User Management) reuses the same pattern.
- Implement the cache-invalidation TODO left by Module 3: any write to a restaurant's core fields must invalidate its Redis viewport/detail cache entries.
- Basic (non-AI) photo attach: for this module, admin can attach already-uploaded photo references directly (a minimal signed-upload endpoint scoped to admin use is acceptable here as a stopgap — the full community `MediaModule` with compression/magic-byte validation for regular users arrives in Module 7; do not over-build user-facing upload security here, just get admin photo attachment working).
- RBAC: enforce `moderator` cannot access restaurant-deletion or user-management-adjacent admin actions (per PRD §10.11 business rule) — reuse the guard built in Module 2.

### Mobile — Restaurant Detail, Photo Gallery, Menu (screens 12-15)
- Full Detail screen per the spec: photo carousel, name/category, rating section (render "Chưa có đánh giá" honestly since Module 6 hasn't shipped real reviews yet — do not fake a score), address+mini-map, hours with open/closed badge, phone with tap-to-call, facilities icons, menu preview (link to full Menu screen), AI Summary section showing its Module 7-pending empty state ("chưa có đủ dữ liệu"), action buttons (Favorite — wire the tap to call the not-yet-built Module 8 endpoint and handle the expected 404/stub gracefully with a TODO, or simply disable the button with a "coming soon" state — your call, document which), Chỉ đường (opens external maps app via deep link with the restaurant's coordinates — this one is fully functional now), Report (stub button navigating to a placeholder until Module 7).
- Photo Gallery: grid + fullscreen swipe viewer, tabbed by source category if photo metadata supports it.
- Menu: grouped list by category, price formatted as VND (e.g., "55.000 ₫").
- Wire real navigation from Map/Search/List into Detail now, replacing the placeholder from Modules 3-4.

### Admin web — Restaurant Management (screen 30)
- Table view with search/filter by status/area, full create/edit form (all fields from the ERD), menu item management (add/edit/remove line items with price), photo attachment, opening hours editor (7-day grid, supports overnight hours), facility toggles, hide/restore/delete actions.

### Seed data
- Write a versioned, re-runnable seed script (`backend/prisma/seed.ts` or equivalent) that creates **30-50 restaurants** meeting every criterion in `docs/10-portfolio-presentation.md` §2: category mix (~40% quán ăn / 25% cà phê / 15% xe đẩy-vỉa hè / 10% nhà hàng / 10% bar), concentrated in real HCMC districts (Quận 1, Quận 3, Bình Thạnh, Phú Nhuận), realistic VND pricing per category, full opening hours (including ≥3 overnight-hours places), varied facility tags, 4-8 photos each (use royalty-free/self-shot images — do not scrape real businesses' actual photos), 6-12 menu items each. Reviews are NOT seeded here (Module 6 doesn't exist yet) — leave that part of the seed script as a documented placeholder Module 6 will extend.
- Run the seed against local dev DB and confirm the map/search/detail experience now feels populated and realistic end-to-end.

## Explicitly out of scope
No review data/UI (Module 6), no community Add Restaurant flow or full media-upload security (Module 7), no AI summary generation (Module 7).

## Definition of Done
- [ ] US-D1–D3 pass manually against seeded data, including at least one overnight-hours restaurant showing "open" correctly at 1am.
- [ ] Every defined empty state (no menu, no photos — pick a couple of seeded restaurants to deliberately under-populate to test this) renders per spec, not a broken layout.
- [ ] Admin can create/edit/hide/restore a restaurant end-to-end through the UI (not just via API calls), and each action produces an `AuditLog` row.
- [ ] `moderator`-role admin account is blocked from restaurant-deletion (403), verified by test.
- [ ] Seed script run from a completely fresh database produces 30-50 restaurants matching the Demo Data Plan's category/data-completeness bar — spot-check at least 5 restaurants manually against the checklist in `docs/10-portfolio-presentation.md` §2.
- [ ] API test coverage for `GET /restaurants/:id` aggregated payload shape (per `docs/09-testing-plan.md` automation priority #5).
