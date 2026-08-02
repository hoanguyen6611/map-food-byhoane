# Module 7 — Contribution, Media Upload, AI Moderation & Admin Moderation Queue

## Context

This is the largest and most product-critical module — it's what makes this a *community* platform instead of an admin-curated directory, and it's where the AI differentiator from `docs/01-prd-mvp.md` §5 becomes real rather than a stand-in. Modules 1-6 give us: auth, map, search, detail, and reviews with a placeholder risk check. This module replaces that placeholder with a real `AIGateway`, adds the community "Add Restaurant" flow, a real media upload pipeline, and the Admin Moderation Queue. Read before starting, in full:
- `docs/01-prd-mvp.md` §10.6 (Add Restaurant), §10.7 (Upload Media), §10.9 (AI Moderation).
- `docs/02-user-stories.md` Epic F (US-F1–F4), Epic G (US-G1–G2), Epic I (US-I2–I4), Epic J (US-J1–J2).
- `docs/06-database-erd.md` §4 (Photo/Video), §6 (Contribution, EditSuggestion), §7 (ModerationResult, Report), §8 `AISummary`.
- `docs/05-system-architecture.md` §4 (AI Gateway Design) — implement the provider-agnostic interface exactly as diagrammed, with the Claude adapter as the sole implementation.
- `docs/03-sitemap-userflow.md` §2.3–2.5 (the review/add-restaurant/moderator sequence diagrams) — this module is what makes those flows real end-to-end.
- `docs/04-screen-list.md` screens 18-21 (Add Restaurant, Select Location, Upload Media, Submission Status), 27 (Report Content), 31 (Admin Moderation Queue).
- `docs/09-testing-plan.md` §4 (Security Test Checklist) — the upload-hardening items there are mandatory for this module, not optional polish.

## Scope

### Backend — `MediaModule`
- `POST /media/upload-url` — issues a short-lived signed upload URL directly to object storage (Cloudflare R2 or your configured S3-compatible bucket), scoped to the requesting user, with a server-enforced max size and allowed content-type.
- `POST /media/confirm` — after the client uploads directly to the signed URL, this endpoint verifies the object actually exists, re-fetches and re-encodes the image server-side (strip EXIF, normalize format, generate a thumbnail ≤400px and a display copy ≤1920px longest edge), and **validates the file's magic bytes match an allowed image type regardless of client-declared MIME/extension** — this is the security-critical step from the Security Checklist; a mismatched or non-image file must be rejected here even if it passed client-side checks. Creates the `Photo` row only after this validation succeeds.
- `DELETE /media/:id` — owner-only (or admin), removes both original and thumbnail from storage.
- Enforce caps: max 6 photos per review, 10 per restaurant submission, 8MB pre-compression client-side limit (still re-validated server-side).

### Backend — `AIModule` (the real AI Gateway)
- Define a provider-agnostic interface: `AIGateway.moderate(content): Promise<{riskScore, labels, reason, recommendedAction}>`, `.parseQuery(text, context): Promise<StructuredFilter>`, `.summarize(restaurantId): Promise<{summaryText, pros, cons}>` — all three return strictly JSON-schema-validated structured output, never raw model text passed to business logic (validate the response against a schema and retry/fail-safe if it doesn't conform).
- Implement one adapter: **Claude API** (per `docs/07-tech-stack.md`). Use tool-use/structured-output mode to guarantee schema conformance.
- `moderate()` must screen for everything listed in `docs/01-prd-mvp.md` §7: profanity/hate/harassment, spam/disguised ads, malicious links, irrelevant content, duplicate/copied reviews, bot-like patterns, irrelevant/violating images (pass image content to the model if the provider supports vision, otherwise screen based on metadata + accompanying text), invalid menu/abnormal pricing, fake-restaurant-info signals.
- **Hard rule, enforced in code, not just prompted:** if `recommendedAction` is `reject` or `riskScore` is above the medium-risk threshold, the system must never transition that content to a published/approved state without a non-null `decidedBy` (moderator). Write a test that proves this even under a simulated buggy/malicious AI response.
- **Fail-safe:** if the AI API call errors or times out, catch it and route the content to `in_review` (hold for manual moderation) — never fail-open to auto-publish. Write a test that kills the AI call and asserts the content lands in the moderation queue, not published.
- Replace Module 6's placeholder risk check in `ReviewModule` with a real call to `AIGateway.moderate()`.
- `AISummary` generation: implement `summarize()` and a trigger (background job) that (re)generates a restaurant's `AISummary` once it crosses the minimum review threshold, and periodically thereafter (e.g., every N new reviews or every 7 days — pick one and document it). Per US-J2, do NOT generate/show a summary below the threshold. Every summary in the API response and UI must carry an explicit "AI-generated" label per the PRD business rule.

### Backend — `ContributionModule`
- `POST /restaurants` (community-facing, distinct from Module 5's admin-facing create) — creates a `Restaurant` with `RestaurantStatus.publicationStatus = 'pending'` plus a `Contribution` row (`type='new_restaurant'`), invisible on public queries until approved. Requires ≥1 photo (via the Media pipeline above).
- Duplicate detection: before final submit, check for existing restaurants within ~50m with a similar name (trigram similarity threshold) and surface a warning to the client with the existing listing's ID; allow the user to explicitly confirm "khác quán này" to proceed anyway.
- `POST /restaurants/:id/edit-suggestions` — creates a `Contribution` (`type='edit_suggestion'`) + `EditSuggestion` (field/oldValue/newValue), routed through the same moderation pipeline; on approval, apply `newValue` to the live entity and keep `oldValue` for history/restore.
- `POST /restaurants/:id/status-reports` — for crowd/seat/outlet/parking updates (`CrowdedStatus`,`SeatAvailability`,`PowerOutletStatus`,`ParkingInformation` per the ERD) and closure/hours/moved/wrong-info reports (`type='status_update'`/`closure_report'` contributions). Implement the "3+ independent closure reports in 14 days auto-escalates" business rule.
- `GET /me/contributions` — status tracking list for the current user.
- All of the above route through `AIModule.moderate()` exactly like reviews do, writing `ModerationResult` rows the same way.

### Backend — `ModerationModule` completion + `AdminModule` moderation queue + Report
- `POST /reports` — create a `Report` (restaurant or review target), enforce one report per user per target (unique constraint), route into moderation.
- `GET /admin/moderation-queue?type=&status=` — list pending `ModerationResult`s across all target types with the AI's risk score/labels/reason attached.
- `POST /admin/moderation-queue/:id/decision` — approve / reject (reason required) / request-edit (reason required); on decision, update the underlying content's status, write `AuditLog`, and enqueue a `Notification` to the contributor (Notification *sending* logic can be a simple DB-row-creation stub here — the full Notification UI/read-API belongs to Module 8, but the row must be created now so Module 8 has real data to display).
- RBAC: verify `moderator` can approve/reject/request-edit but cannot perform admin-only actions (already partially covered by Module 2's guard — extend as needed).

### Mobile — Add Restaurant, Select Location, Upload Media, Submission Status, Report Content (screens 18-21, 27)
- Full stepper flow per the screen spec, wired to the real endpoints above, including the duplicate-warning interstitial.
- Select Location: map with a fixed center pin, drag-to-position, "use my GPS" button, reverse-geocode display (use a real geocoding provider if credentials are available; otherwise store raw coordinates and let the user manually type the address fields as a fallback — document whichever path you took).
- Upload Media: build this as the shared component described in the screen spec (grid of selected photos, capture/pick, per-photo progress, delete) — this component is reused by Write Review (retrofit Module 6's placeholder to use it now).
- Submission Status: timeline UI reflecting `Contribution`/`ModerationResult` state, with resubmit-after-edit-request support.
- Report Content: reason list + optional description, duplicate-report prevention surfaced from the API's unique-constraint error.
- Wire the FAB "+" on Home Map (left as a TODO since Module 3) to this real Add Restaurant flow now.

### Admin web — Moderation Queue (screen 31)
- Full queue UI per the spec: tabbed by content type, each item showing content + AI risk score + AI reason + related report history, decision panel with required-reason enforcement for reject/edit-request.

## Explicitly out of scope
Full Notification read UI (Module 8), Favorites (Module 8), any performance/security hardening pass beyond what's specified above as mandatory for this module's own attack surface (broader hardening is Module 8).

## Definition of Done
Verify against `docs/02-user-stories.md` Epics F/G/I/J and `docs/09-testing-plan.md` automation priorities #6, #8, #10:
- [ ] US-F1–F4, US-G1–G2, US-I2–I4, US-J1–J2 pass manually and via automated tests.
- [ ] Security checklist items for file upload (magic-byte mismatch rejection, oversized file rejection, no executable content-type ever served back) verified with actual malformed test files, not just code review.
- [ ] AI fail-safe verified: simulate an AI API outage/error and confirm content lands in `in_review`, never auto-published.
- [ ] AI hard rule verified: a mocked AI response with `recommendedAction: reject` cannot reach `decision: approved` without a `decidedBy` — test this at the service layer, not just trust the prompt.
- [ ] A full end-to-end run of the Module 3 sequence diagram (`docs/05-system-architecture.md` §5) works for real: submit a review → AI screens it → auto-publish (clean content) or moderator queue (flagged content) → moderator decides → contributor sees updated Submission Status.
- [ ] Duplicate-restaurant detection triggers correctly for a restaurant submitted within 50m of an existing one with a similar name.
- [ ] AI Summary does not appear below the minimum review threshold, and is visibly labeled "AI-generated" wherever shown.
- [ ] Admin Moderation Queue: reject/request-edit without a reason is blocked client- and server-side.
