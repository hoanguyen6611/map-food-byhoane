# Module 8 — Favorites, Notifications, Security/Performance Hardening & Demo Readiness

## Context

Modules 1-7 done: the product is functionally complete against the MVP scope in `docs/01-prd-mvp.md`. This final module adds the two remaining small features, then spends the rest of its scope making the whole system trustworthy and demo-ready rather than adding anything new. Read before starting:
- `docs/01-prd-mvp.md` §10.10 (Favorites) and §13 (Non-Functional Requirements).
- `docs/02-user-stories.md` Epic H (US-H1–H2).
- `docs/04-screen-list.md` screens 22 (Favorites), 25 (Notifications), 26 (Settings).
- `docs/09-testing-plan.md` in full — this module is where its Security Checklist, performance (k6) tests, and accessibility pass actually get executed, not just documented.
- `docs/10-portfolio-presentation.md` in full — this module is where its Presentation Assets Checklist gets produced.

## Scope

### Backend — `Favorite` + `Notification` completion
- `POST /favorites/:restaurantId`, `DELETE /favorites/:restaurantId`, `GET /me/favorites` — straightforward, enforce `(userId, restaurantId)` uniqueness idempotently (toggling twice doesn't error, just reflects final state).
- `GET /me/notifications`, `PATCH /me/notifications/:id/read` — surfacing the `Notification` rows Module 7 already started writing on moderation decisions. Add push-notification delivery only if you have real APNs/FCM credentials available (via `expo-notifications`); otherwise ship in-app-only and clearly note push delivery as a documented gap, not a silent omission — per PRD Assumption A4, marketing push is explicitly out of scope, only transactional matters here.

### Mobile — Favorites, Notifications, Settings (screens 22, 25-26)
- Wire the Detail screen's Favorite button (left disabled/TODO since Module 5) to the real endpoint with optimistic UI update, consistent across every screen showing that restaurant (Home Map preview, Search Result card, Favorites list, Detail).
- Notifications list with read/unread state, deep-linking to the relevant screen (Submission Status, Reviews) per notification type.
- Settings: dark mode toggle (verify the design system actually supports both themes per `docs/01-prd-mvp.md` §15 requirement — if light/dark tokens weren't built into the component library yet, this module must finish that, not just add a toggle that does nothing), account deletion flow (wired to Module 2's `DELETE /me`, with the required 2-step confirmation), logout.

### Cross-cutting: Security hardening pass
Run every item in `docs/09-testing-plan.md` §4 (Security Test Checklist) for real against the running system, not just in code review — SQL injection attempts against search/filter params, JWT tampering, rate-limit verification on every endpoint listed in the PRD, file upload abuse (re-verify Module 7's magic-byte checks with fresh adversarial test files), RBAC/IDOR checks (a user editing another user's review/favorite by guessing IDs), secret-exposure check on the mobile bundle, password-reset-token reuse check. Fix anything that fails before marking this module done — do not defer security findings to "later."

### Cross-cutting: Performance pass
- Write k6 scripts (per `docs/09-testing-plan.md` §1) against `/restaurants/nearby`, `/restaurants/bounds`, and `/search`, run against the full 30-50 restaurant seed dataset plus its seeded reviews, and confirm p95 latency targets from the PRD NFRs. If any endpoint misses target, profile and fix (likely candidates: missing index usage, N+1 query in the Detail aggregation, cache not actually hitting) before declaring done.
- Re-verify map first paint and marker-clustering behavior feels smooth on a real device, not just a simulator, if a device is available.

### Cross-cutting: Accessibility pass
Run a screen-reader pass (VoiceOver/TalkBack) across the primary flows (Login, Home Map, Search Result, Detail, Write Review) and fix missing labels/contrast issues found — this is a real pass, not a checkbox; per `docs/01-prd-mvp.md` §13 the design system commits to WCAG AA.

### Demo readiness
- Execute the Demo Data Plan validation from `docs/10-portfolio-presentation.md` §2 fully (not just the spot-check Module 5 did) — confirm all 30-50 restaurants meet the completeness bar, including deliberately sparse ones for empty-state demonstration.
- Produce the Presentation Assets Checklist items from `docs/10-portfolio-presentation.md` §5: demo video/GIF, polished screenshots, exported architecture diagram, and — if deploying — a live demo link with a seeded read-only or demo-credential account.
- Update the root README per the structure in `docs/10-portfolio-presentation.md` §3.

## Explicitly out of scope
Any new feature not already specified in Modules 1-7 — this module's job is to finish and harden, not expand. If something from the PRD's MVP scope was accidentally skipped in an earlier module, fix it here and note which module's Definition of Done should have caught it (feedback loop for future projects), but do not use this as a chance to add Phase 2+ features.

## Definition of Done — this is the MVP-complete gate
Verify against `docs/01-prd-mvp.md` in full:
- [ ] US-H1–H2 pass; favorite state is instantly consistent across every screen showing a given restaurant.
- [ ] Notifications deep-link correctly for both notification types generated so far (contribution status, moderation result).
- [ ] Dark mode fully functional, not just a non-functional toggle.
- [ ] Every item in the Security Test Checklist passes against the running system.
- [ ] k6 performance results meet the NFR targets in `docs/01-prd-mvp.md` §13, or documented remediation is in place.
- [ ] Accessibility pass complete on the 5 primary flows listed above.
- [ ] All P0 user stories across every epic in `docs/02-user-stories.md` are verified end-to-end in one continuous manual walkthrough without a crash (this is literally the Phase 1 exit criterion from `docs/08-roadmap-sprint.md`).
- [ ] Demo assets (video, screenshots, architecture diagram, README) exist and match `docs/10-portfolio-presentation.md`.
