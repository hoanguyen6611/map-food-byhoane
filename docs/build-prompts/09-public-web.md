# Module 9 — Public Web (Phase 1.5: SEO/Discovery)

## Context

This module is **Phase 1.5**, not part of the original 8-module Phase 1 MVP plan — it was added to scope mid-project (see `docs/01-prd-mvp.md` §15 assumption A7, `docs/07-tech-stack.md` §5, and `docs/08-roadmap-sprint.md`'s "Phase 1.5 — Public Web" section for the full decision record). The project owner explicitly chose to build this before Module 7 (Contribution/Media/AI Moderation/Moderation Queue), out of the original dependency order — Module 7 remains the next MVP module once this is done.

**Goal:** give the product a Google-indexable public surface that the mobile app structurally cannot have — organic search traffic to restaurant detail and listing pages. This is explicitly **not** a second mobile app rebuilt for the web; read-heavy discovery pages are server-rendered and indexable, write actions (review, favorite, add restaurant) are out of scope for this module (see below).

Read before starting:
- `docs/07-tech-stack.md` §5 — the Next.js decision and scope boundary.
- `docs/08-roadmap-sprint.md` — Phase 1.5 entry (goals, dependencies, exit criteria).
- `docs/01-prd-mvp.md` §15 assumption A7.
- Whatever backend read endpoints already exist and are stable: `GET /restaurants/:id`, `GET /restaurants/nearby`, `GET /restaurants/bounds`, `GET /search`, `GET /restaurants/:id/reviews` (all built in Modules 3-6 — this module is backend-read-only, it adds no new backend endpoints unless profiling proves a real need).

## Scope

### New workspace — `web/`
- Next.js (App Router) + TypeScript, added as a new npm workspace alongside `backend/`, `mobile/`, `admin-web/`.
- Imports `@foodmap/shared-types` directly, same as every other app — do not redefine DTOs.
- SSR/SSG for every page that needs to be indexable; no client-only rendering for primary content.

### Pages
- **Home** (`/`) — hero + pitch, a search entry point, and a few highlighted categories/districts linking into listing pages. Real content, not a placeholder — this is the landing page search engines and cold-traffic visitors see first.
- **Search/listing** (`/tim-kiem` or `/search`, query-param driven) — SSR list of restaurants via the existing `GET /search` contract (q, cuisine, facilities, price, district, etc.). Paginated, real data, no fabricated placeholders.
- **Restaurant detail** (`/quan/[slug]` or similar — use the restaurant's `slug` field, not its uuid, for a clean indexable URL; resolve slug → id server-side) — the highest-value SEO page. Full server-rendered detail: name, address, hours w/ open-now badge, price range, facilities, photos, menu preview, and the review list/rating breakdown (read-only). Reuse the exact same honesty rules as mobile: never fabricate a rating/AI summary that doesn't exist server-side.
- **404 / not-found** for an unknown slug.

### SEO infrastructure (the actual point of this module — do not treat as optional polish)
- `generateMetadata` per page: accurate `<title>`/`<meta description>`, Open Graph tags (og:title, og:description, og:image if a real photo exists), for both listing and detail pages.
- JSON-LD structured data (`schema.org/Restaurant`) embedded on every restaurant detail page — this is a concrete, high-value SEO artifact, not a nice-to-have.
- `sitemap.xml` (Next.js's built-in `sitemap.ts` route) enumerating every published restaurant detail page + the static pages.
- `robots.txt` allowing the above.

### Write actions (explicit scope boundary — do not build auth here)
No login, no write-review form, no favorite button, no add-restaurant flow on web in this module. Where a mobile-only action would normally appear (write a review, save a favorite), show a clear, honest call-to-action explaining the action requires the mobile app — do not fake a working button, and do not build a parallel web auth system. Exact wording/treatment is this module's own call to make; document the choice.

## Explicitly out of scope
Web-based auth/login, write review, favorites, add-restaurant/contribution flow, admin functionality (that's `admin-web/`, already a separate app), a full mobile-feature-parity rebuild. Any of these landing here later is a deliberate future phase decision, not an oversight to fix retroactively — see `docs/07-tech-stack.md` §5's scope boundary note.

## Definition of Done
- [ ] `npm run build` (Next.js production build) succeeds with no type errors.
- [ ] Home, search/listing, and at least 5 real restaurant detail pages render server-side with correct data (verify via "view source," not just the rendered DOM — the whole point is that content is present before JS runs).
- [ ] `generateMetadata` produces correct, per-page title/description/OG tags — verify by inspecting the actual rendered `<head>`.
- [ ] JSON-LD `Restaurant` structured data validates (spot-check with Google's Rich Results Test format expectations, even if not run through the live tool).
- [ ] `sitemap.xml` and `robots.txt` are reachable and list real restaurant URLs.
- [ ] A restaurant with 0 reviews/photos/menu renders the same honest empty states as mobile — no fabricated data.
- [ ] Write-action call-to-actions (review/favorite/add-restaurant) are honest about requiring the mobile app, never a dead/fake button.
