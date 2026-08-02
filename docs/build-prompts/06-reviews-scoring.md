# Module 6 — Reviews & Composite Scoring

## Context

Modules 1-5 done: a fully browsable, seeded (but review-less) product exists. This module adds the structured review system and the scoring algorithm that is one of this product's core differentiators (see `docs/01-prd-mvp.md` §5 UVP). Read before starting:
- `docs/01-prd-mvp.md` §10.5 (Review) and §10.8 (Rating & Composite Score) feature specs — the Bayesian damping formula is specified exactly in §10.8, implement that formula, do not invent a different one.
- `docs/02-user-stories.md` Epic E (US-E1–E5).
- `docs/06-database-erd.md` §5 (ReviewCriteria, Review, ReviewRating).
- `docs/04-screen-list.md` screens 16-17 (Reviews, Write Review).
- `docs/05-system-architecture.md` §5 (the moderation sequence diagram) — this module implements the "pending → published" happy path of that flow using a **simple rule-based risk check as a stand-in** (e.g., profanity wordlist, review-frequency check) since the real AI Gateway doesn't exist until Module 7. Wire the `ModerationResult` table and status transitions exactly as the real pipeline will use them, so Module 7 only has to swap the risk-scoring implementation, not the surrounding state machine.

## Scope

### Backend — `ReviewModule`
- Migration: `ReviewCriteria` (seed with MVP criteria: `food_quality`,`space`,`price`,`service`,`hygiene`,`wifi`,`parking`), `Review`, `ReviewRating`.
- `POST /reviews` — accepts `restaurantId`, `overallRating` (required), criteria ratings (at least one required), optional `dishesOrdered`, `billTotalVnd`, `partySize`, `visitedAt`, `waitTimeMinutes`, `wouldReturn`, `comment`, and photo references (accept pre-uploaded IDs for now — full upload pipeline is Module 7). Enforce: one active review per user per restaurant within 24h (per US-E5 — check for an existing non-deleted review by this user for this restaurant created/updated in the last 24h and block with the specified message), `billTotalVnd` sanity bounds, `comment` length cap.
- Stand-in risk check: a simple synchronous or queued check (basic profanity/spam wordlist match, or just an "auto-approve everything for now" placeholder that is explicitly `// TODO Module 7: replace with real AIGateway.moderate() call` — pick whichever lets you demonstrate the state machine, but do not skip creating a `ModerationResult` row, since Module 7 depends on that table already being populated correctly).
- `PATCH /reviews/:id` — owner-only edit; if edited >48h after creation, set `editedAt` (public "Đã chỉnh sửa" marker per business rule).
- `DELETE /reviews/:id` — owner-only soft delete.
- `GET /restaurants/:id/reviews?sort=&filter=` — paginated, sort by newest/most-helpful/has-photos.
- Background job (BullMQ, per architecture doc): on review create/update/delete, recompute `RestaurantStatus.compositeScore`/`reviewCount`/`lastReviewAt` using the exact formula from PRD §10.8: `compositeScore = (v/(v+m))*R + (m/(v+m))*C` where `m=5` (minimum votes threshold), `R`=this restaurant's raw average, `C`=global prior mean across all published restaurants. Write a unit test asserting a restaurant with 2 five-star reviews scores lower than one with 50 reviews averaging 4.6 — this is the concrete acceptance bar from the PRD.
- Update `GET /restaurants/:id` (from Module 5) to now populate the real `reviews`/`compositeScore`/`reviewCount` fields it left empty.
- Update `SearchModule`'s ranking (the `// TODO Module 6` left in Module 4) to fold `compositeScore` into result ordering.

### Mobile — Reviews, Write Review (screens 16-17)
- Reviews screen: rating breakdown by criteria at top, sort/filter controls, review list (reuse a `ReviewCard` component), floating "Viết đánh giá" button, wired to the real `AuthGateModal` from Module 2 if the user is a guest.
- Write Review: full form per the screen spec (overall rating required, per-criterion ratings with a way to skip inapplicable ones, dishes-ordered tag input, bill total VND input with formatting, party size, visited-at picker, wait time, comment textarea with 2000-char counter, "would return" toggle, photo attach placeholder pointing at Module 7's upload component). Handle the 24h-duplicate-block error message from the API. Show "Đang chờ duyệt" vs "Đã đăng" based on the returned status.
- Update Restaurant Detail (from Module 5) to now show the real rating breakdown and review preview instead of the "Chưa có đánh giá" placeholder (keep that empty state for genuinely review-less restaurants).

### Seed data extension
Extend Module 5's seed script to add 8-20 reviews per seeded restaurant (per the Demo Data Plan), with **varied** ratings (not all 5-star) across simulated distinct users, so the composite-score damping is visibly meaningful in the demo. Leave ≥5 restaurants with 0-1 reviews deliberately, to exercise the low-data empty/honest-score states.

## Explicitly out of scope
No real AI moderation (stand-in only, replaced in Module 7), no photo upload pipeline (Module 7), no report-content flow yet (Module 7 also owns `Report`).

## Definition of Done
Verify against `docs/02-user-stories.md` Epic E and `docs/09-testing-plan.md` automation priority #7:
- [ ] US-E1–E5 pass manually and via automated API tests.
- [ ] Composite score unit test (2×5-star vs. 50×4.6-avg comparison) passes.
- [ ] Submitting a review triggers the recompute job and `GET /restaurants/:id` reflects the updated score within the job's completion window (assert <5s in a test).
- [ ] Editing a review >48h after creation shows the "Đã chỉnh sửa" marker; editing within 48h does not.
- [ ] Seed data now includes varied, realistic reviews per the extended seed script; at least 5 restaurants remain in a genuine low-review state.
- [ ] Search ranking visibly reflects composite score (a highly-rated, well-reviewed seeded restaurant should rank above a mediocre one for a shared matching query).
