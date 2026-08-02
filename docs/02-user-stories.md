# User Stories & Acceptance Criteria — MVP

Format: `ID — As a <role>, I want <capability>, so that <benefit>.` Acceptance criteria in Given/When/Then. Priority: **P0** (blocks MVP launch), **P1** (should have for MVP), **P2** (nice-to-have, can slip to V1).

## Epic A — Authentication

**US-A1 [P0].** As a guest, I want to register with email and password, so that I can save favorites and post reviews.
- Given a valid unused email and a password ≥8 chars with a number, when I submit registration, then my account is created and I'm logged in automatically.
- Given an email already registered, when I submit registration, then I see "Email đã được sử dụng" without revealing whether it's linked to Google/Apple or email/password.

**US-A2 [P0].** As a returning user, I want to log in with email/password or Google/Apple, so that I don't have to re-register.
- Given correct credentials, when I log in, then I receive an access token (short-lived) and refresh token (long-lived) and land on Home Map.
- Given 5 failed attempts within 15 minutes, when I try again, then I'm rate-limited with a clear cooldown message.

**US-A3 [P1].** As a user, I want to reset my forgotten password via email link, so that I can regain access.
- Given a registered email, when I request a reset, then a single-use link valid for 30 minutes is sent; given an already-used or expired link, when I open it, then I see an explicit "link expired, request a new one" state.

**US-A4 [P1].** As a user, I want to edit my basic profile (name, avatar, phone), so that my identity is accurate.
- Given a valid VN phone format, when I save, then the profile updates; given an invalid format, then inline validation blocks save.

**US-A5 [P2].** As a user, I want to delete my account, so that I can exercise data control.
- Given a delete request, when confirmed twice (friction against accidental deletion), then my personal data is anonymized and content is retained per moderation/audit needs (not hard-deleted, per Business Rule 6).

## Epic B — Map & Location

**US-B1 [P0].** As a user, I want to see restaurants near my current location on a map, so that I can discover options nearby without typing anything.
- Given location permission granted, when Home Map loads, then markers within the default radius render clustered, centered on my position, within 2s on 4G.
- Given location permission denied, when Home Map loads, then I see a banner explaining reduced accuracy and a manual location picker, and the map still functions centered on a default city.

**US-B2 [P0].** As a user, I want the marker list to update as I pan/zoom the map, so that I always see relevant results for the area I'm looking at.
- Given I pan the map, when I stop moving for ≥500ms, then new markers for the current viewport are fetched and rendered without a full-screen loading block.

**US-B3 [P1].** As a user, I want tapping a cluster to zoom in and split it, so that I can drill into dense areas.
- Given a cluster of 12 markers, when I tap it, then the map zooms to a level where the cluster splits into sub-clusters or individual markers.

**US-B4 [P0].** As a user, I want a tap on a marker to show a quick preview card, so that I can decide whether to open full details.
- Given I tap a marker, when the preview renders, then it shows name, thumbnail, rating, price range, distance, open/closed badge, and a button to full detail.

## Epic C — Search & Filter

**US-C1 [P0].** As a user, I want to search by restaurant name, dish, or cuisine, so that I can find something specific quickly.
- Given I type ≥2 characters, when results return, then matches are ranked by relevance and composite score, and Vietnamese diacritics-insensitive matching works (e.g., "com tam" matches "cơm tấm").

**US-C2 [P0].** As a user, I want to filter by distance, price range, rating, open-now, and facilities, so that results match my real constraints.
- Given multiple filters selected, when applied, then results satisfy all filters simultaneously (AND logic), and the active filter count badge is visible.

**US-C3 [P1].** As a user, I want my recent searches suggested, so that I don't retype common queries.
- Given I have prior searches, when I focus the search bar with an empty query, then my last 5 searches show as suggestions.

**US-C4 [P2].** As a user, I want to sort results (distance, rating, price), so that I control the ordering beyond the default composite score.

## Epic D — Restaurant Detail

**US-D1 [P0].** As a user, I want a full detail page with photos, menu, hours, price, and reviews, so that I can decide to go without leaving the app.
- Given a restaurant with partial data (e.g., no video), when I open detail, then missing sections show a defined empty state, not a broken layout.

**US-D2 [P1].** As a user, I want to see whether a place is open right now, so that I don't arrive at a closed restaurant.
- Given current time and stored opening hours in `Asia/Ho_Chi_Minh`, when I view detail, then an "Đang mở cửa"/"Đã đóng cửa" badge renders accurately, including overnight hours (e.g., 18:00–02:00).

**US-D3 [P1].** As a user, I want to tap "Chỉ đường" to open my preferred external maps app, so that I can navigate without switching context manually.

## Epic E — Reviews

**US-E1 [P0].** As a user, I want to submit a structured review rating multiple criteria, so that my feedback is more useful than a single star.
- Given at least the overall rating + 1 criterion filled, when I submit, then the review enters the moderation pipeline and I see "Đang xử lý" immediately.

**US-E2 [P1].** As a user, I want to optionally add dishes ordered, bill total, party size, and photos to my review, so that it's more credible and useful to others.

**US-E3 [P1].** As a user, I want to edit or delete my own review, so that I can correct mistakes or remove outdated feedback.
- Given I edit a review after 48h, when it's saved, then it displays an "Đã chỉnh sửa" marker publicly.

**US-E4 [P0].** As a user, I want to report an inappropriate review, so that the community stays trustworthy.
- Given I submit a report with a reason, when submitted, then it appears in the moderator queue with the reported content and my reason, and I cannot report the same review twice.

**US-E5 [P1].** As a user, I want to be blocked from submitting a second review for the same place within 24 hours, so that review-bombing is discouraged.

## Epic F — Add Restaurant (Contribution)

**US-F1 [P0].** As a user, I want to add a new restaurant with location, basic info, and at least one photo, so that I can contribute places missing from the map.
- Given required fields and ≥1 photo, when I submit, then the restaurant is created with status `pending` and is invisible on the public map until approved (or auto-approved by AI).

**US-F2 [P1].** As a user, I want to be warned if a similar restaurant already exists nearby, so that I don't create duplicates.
- Given a name-similarity + ~50m proximity match, when I submit, then I see a duplicate warning with a link to the existing listing before final submit.

**US-F3 [P1].** As a user, I want to track the status of my submissions, so that I know if they were approved, rejected, or need edits.

**US-F4 [P1].** As a user, I want to report that a restaurant has closed, moved, changed hours, or has wrong info, so that the map stays accurate.
- Given I submit a "closed" report, when 3+ independent users report the same within a rolling window, then the restaurant is auto-flagged for priority moderator review (not auto-hidden).

## Epic G — Media Upload

**US-G1 [P0].** As a user, I want to capture or pick a photo and attach it to a review/submission, so that I can provide visual proof.
- Given a photo ≤8MB of an allowed type, when uploaded, then I see progress and a thumbnail on success; given an unsupported type, then it's rejected before upload starts.

**US-G2 [P1].** As a user, I want to remove a photo I added before final submit, so that I can fix mistakes.

## Epic H — Favorites

**US-H1 [P0].** As a user, I want to save/unsave a restaurant to favorites, so that I can find it again easily.
- Given I tap the heart icon anywhere the restaurant appears, when toggled, then the state is reflected instantly and consistently across all screens showing that restaurant.

**US-H2 [P0].** As a user, I want to view my full favorites list, so that I can revisit saved places.

## Epic I — Admin & Moderation

**US-I1 [P0].** As an admin, I want to create/edit/hide restaurants directly, so that I can seed and curate high-quality data.

**US-I2 [P0].** As a moderator, I want a queue of pending submissions/reviews/reports with AI risk scores and reasons, so that I can act quickly and consistently.
- Given an item in queue, when I open it, then I see the content, the AI's risk score, AI's stated reason, and the reported/flagged history if any.

**US-I3 [P0].** As a moderator, I want to approve, reject, or request edits with a reason, so that contributors get actionable feedback.
- Given I reject a submission, when I submit a reason, then the contributor receives a notification with that reason and can resubmit.

**US-I4 [P1].** As an admin, I want to manage user accounts (suspend/ban), so that I can handle abuse.

**US-I5 [P0].** As an admin, I want every moderation/admin action logged with actor and timestamp, so that actions are auditable.

## Epic J — AI (baseline, MVP)

**US-J1 [P0].** As the system, I want every new review/submission/photo screened by AI for risk (toxicity, spam, fake, irrelevant) before publish, so that harmful content doesn't reach users unfiltered.
- Given the AI service is unavailable, when content is submitted, then it fails safe into the moderation queue rather than auto-publishing.

**US-J2 [P1].** As a user, I want to read an AI-generated summary of pros/cons on a restaurant's page, so that I get a quick synthesized view without reading every review.
- Given fewer than a minimum review threshold, when I view detail, then no AI summary is shown (avoids hallucinated conclusions from sparse data) — a "not enough data yet" state shows instead.
- Given an AI summary is shown, then it is visibly labeled as AI-generated.

---

## Traceability note
Every story above maps 1:1 to a feature in [01-prd-mvp.md](01-prd-mvp.md) §10 and to endpoints defined in the forthcoming API Specification. Stories tagged P2 are explicitly allowed to slip to V1 if sprint capacity (see [08-roadmap-sprint.md](08-roadmap-sprint.md)) is tight — they are not MVP blockers.
