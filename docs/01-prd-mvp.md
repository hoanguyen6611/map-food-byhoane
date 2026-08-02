# The Food Map of Vietnam — Product Requirements Document (MVP)

Status: Draft v1.0 · Owner: Hoa Nguyen · Last updated: 2026-08-01

Legend for priority tags used throughout this document: **[MVP]** must ship in Phase 1 · **[V1]** first post-launch iteration · **[V2]** community/AI phase · **[Future]** business/monetization phase.

---

## 1. Executive Summary

The Food Map of Vietnam is a mobile-first, community-powered food discovery platform for Vietnam. It combines a specialized map of restaurants/cafés/street vendors, structured multi-criteria reviews, and an AI layer (natural-language search, recommendation explanation, review summarization, content moderation) to answer a question Google Maps does not answer well: **not "what's nearby," but "what's actually right for me, right now."**

*Scope update (added during the Module 5→6 transition, see A7 in §15):* a public, SEO-focused end-user web app is now planned as a follow-on phase after Phase 1 (mobile MVP) completes — see [08-roadmap-sprint.md](08-roadmap-sprint.md) §1 "Phase 1.5 — Public Web" and [07-tech-stack.md](07-tech-stack.md) §5. This does not change the MVP's mobile-first scope below; it adds a phase after it.

This is currently a solo portfolio project, but every architectural and product decision in this document is made as if it will become a real, commercially viable product — modular monolith backend, clean domain boundaries, admin tooling for manual data seeding, and a moderation pipeline that assumes real user-generated content from day one.

## 2. Product Vision

*"Every meal in Vietnam should be easy to discover, trust, and enjoy — through a map built by the community it serves."*

## 3. Product Mission

Build the most trustworthy, food-specific discovery layer for Vietnam by combining structured community data (real menus, real prices, real photos) with AI that explains its recommendations instead of just ranking by distance or stars.

## 4. Product Positioning

- **Category:** Food & beverage discovery platform (map + social + AI), Vietnam-first.
- **Not:** a general-purpose maps app, a delivery app, a booking app (in MVP).
- **Analogy set:** "Google Maps for food" × "Letterboxd/Untappd-style structured reviews for restaurants" × "AI concierge that explains its picks."

## 5. Unique Value Proposition

> **Google Maps helps you find the nearest place. The Food Map of Vietnam helps you find the right place** — for your budget, your taste, your group, your purpose, and this exact moment (open now, not too crowded, has outlets, has parking) — with an AI that tells you *why*, and a community that keeps the data honest.

Core differentiators vs. generic maps (detailed in §9 Competitive Analysis):
1. Structured, criteria-based reviews (not just 1 star + text).
2. Real menus with real prices and real dish photos, contributed and moderated.
3. Live-ish situational signals: crowd level, seat availability, power outlet availability, parking.
4. AI recommendation with a human-readable "why," not a black-box ranking.
5. AI-generated restaurant summary (pros/cons) synthesized from recent community data.
6. Purpose-built for Vietnam's informal food scene: street stalls, xe đẩy, quán không thương hiệu.
7. Community discovery of "hidden gem" places that never get onto mainstream maps.

## 6. User Personas

| Persona | Profile | Core need | Key MVP touchpoint |
|---|---|---|---|
| **Sinh viên "Minh"** | 20, sống gần trường, ngân sách hẹp (<50k/bữa) | Quán ngon-rẻ gần trường, biết giờ nào đông | Search + filter theo giá, Home Map |
| **Nhân viên văn phòng "Lan"** | 27, giờ nghỉ trưa 60 phút, làm việc quận 1 | Quán ăn trưa nhanh, không quá đông, gần văn phòng | Filter khoảng cách + thời gian chờ, AI search |
| **Gia đình "Anh Tuấn & vợ"** | 35–40, có con nhỏ, đi ô tô | Quán có chỗ đậu xe, không gian phù hợp trẻ em | Filter tiện ích, Restaurant Detail |
| **Khách du lịch "Sarah"** | Nước ngoài/tỉnh khác, không rành khu vực | Quán uy tín, tránh bẫy du lịch, review thật | Photo Gallery, Review, khoảng cách từ khách sạn |
| **Food reviewer "Khoa"** | Có kênh mạng xã hội nhỏ, thích khám phá quán mới | Đóng góp nội dung, được ghi nhận, khám phá quán ẩn | Add Place, Write Review, (V2: contributor ranking) |
| **Chủ quán "Chị Hoa"** *(Future role, MVP: passive)* | Chủ quán ăn/cà phê nhỏ | Kiểm soát thông tin quán, tương tác khách | Không có tính năng chủ động trong MVP; dữ liệu/role đã thiết kế sẵn |
| **Quản trị viên "Admin"** | Chính người vận hành dự án | Seed & duyệt dữ liệu chất lượng cao | Admin Portal (toàn bộ) |
| **Moderator** *(MVP: cùng người với Admin)* | Duyệt nội dung rủi ro | Xử lý hàng đợi kiểm duyệt nhanh, chính xác | Moderation Queue |

## 7. User Problems

| # | Problem | Evidence/rationale | Severity |
|---|---|---|---|
| P1 | Google Maps reviews are unstructured, often fake/generic ("ngon", "5 sao"), hard to trust | Single star rating hides *what* is good/bad | High |
| P2 | No reliable way to filter by real budget per person, not just price-tier symbols | "$$" is meaningless in VND context | High |
| P3 | No visibility into situational factors: crowded now? seat free? outlet free? parking? | These change hour-to-hour; static listings can't capture it | High |
| P4 | Small/unbranded/street vendors are invisible or poorly represented on mainstream maps | Vietnam's food culture is dominated by informal vendors | Medium-High |
| P5 | Menus and prices on existing platforms are outdated or missing photos of actual dishes | Users can't decide before arriving | Medium |
| P6 | Decision fatigue: "I don't know what to eat today" has no good product answer | No product frames search as *recommendation*, only as *lookup* | Medium |
| P7 | No purpose-aware search (romantic date vs. work session vs. family outing vs. late-night) | Filters exist by category, not by *intent* | Medium |

## 8. Product Opportunities

- O1: Own the "criteria-based food review" data model in Vietnam before a bigger player does.
- O2: AI-explainable recommendation is a genuine UX differentiator, cheap to prototype with an LLM, expensive for incumbents to retrofit into star-rating UX.
- O3: Community contribution + light gamification (V2) can bootstrap coverage of informal vendors that Google will never prioritize.
- O4: Admin-curated seed dataset (30–50 places) makes the product demo-able and credible before any real user contributes — de-risks the cold-start problem for a portfolio context.
- O5: Clean role/data design for restaurant owners and monetization (Section 12–13 of the brief) means the same schema supports a future commercial pivot without a rewrite.

## 9. Competitive Analysis

| Dimension | Google Maps | Foody / TripAdvisor-style | ShopeeFood / GrabFood (discovery use) | **The Food Map of Vietnam** |
|---|---|---|---|---|
| Review structure | Single star + free text | Single star + free text, some tags | Order-based rating only | Multi-criteria structured ratings |
| Real menu + price | Rare, unverified | Sometimes | Yes, but only for delivery-partnered venues | Community + admin verified menu/price |
| Situational status (crowd, seats, outlets) | No | No | No | Yes (MVP: manual community update) |
| Coverage of street vendors | Poor | Poor | Poor (delivery-only) | Core focus |
| AI explainable recommendation | No | No | No | Yes |
| AI content moderation w/ human-in-loop | Generic spam filter | Unknown/manual | N/A | Purpose-built pipeline (§ Moderation) |
| Vietnam-specific UX (address levels, VND, phone format) | Generic | Generic | Vietnam-specific but delivery-only | Vietnam-specific, discovery-first |
| Data ownership/openness for a niche use case | Closed | Closed | Closed | Own dataset, own schema, extensible |

**Takeaway:** the wedge is not "better map," it's "better *food decision-making* data model + AI layer," with Vietnam's informal food scene as underserved territory incumbents have no incentive to serve well.

---

## 10. MVP Scope

Each feature below follows the required template: Purpose · Actors · Preconditions · Main flow · Exception flow · Business rules · Validation · Acceptance criteria · Related data · Related API · Risk · Priority.

### 10.1 Authentication **[MVP]**

- **Purpose:** Let users create a trusted identity so contributions, reviews and favorites can be attributed and moderated.
- **Actors:** Guest, Registered User, Admin.
- **Preconditions:** None for registration; valid session for profile actions.
- **Main flow:** Register (email+password or Google/Apple OAuth) → verify email (soft, non-blocking for MVP) → login → receive access+refresh token → use app.
- **Exception flow:** Duplicate email → error; wrong password → generic error (no user enumeration); expired refresh token → force re-login; OAuth cancelled → return to login unchanged.
- **Business rules:** One account per email; guest can browse map/search/detail read-only but cannot review/add/favorite; password reset link expires in 30 minutes, single-use.
- **Validation:** Email format; password ≥ 8 chars incl. 1 number; VN phone format `+84` or `0` + 9–10 digits if phone added.
- **Acceptance criteria:** Given valid credentials, user logs in within 1 request and receives a valid JWT pair; given wrong password 5x in 15 min, account is temporarily rate-limited.
- **Related data:** `User`, `UserProfile`, `Role`.
- **Related API:** `POST /auth/register`, `POST /auth/login`, `POST /auth/oauth/{provider}`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`.
- **Risk:** OAuth token validation must be server-side verified, not trusted from client. **Priority: MVP.**

### 10.2 Map & GPS **[MVP]**

- **Purpose:** Visual, location-centered discovery of restaurants.
- **Actors:** Guest, Registered User.
- **Preconditions:** Location permission granted (or manual location fallback).
- **Main flow:** Open Home Map → request location permission → center map on user → fetch restaurants within viewport → render clustered markers → pan/zoom refetches → tap marker → mini card → tap card → Restaurant Detail.
- **Exception flow:** Permission denied → fallback to last known city-level location or manual city/district picker, banner explains reduced accuracy; GPS timeout → retry + manual search fallback; zero results in viewport → empty state with "increase radius" CTA.
- **Business rules:** Default search radius 3 km in dense urban areas, up to 10 km in low-density areas; clustering activates above ~30 markers per viewport; max 200 markers fetched per viewport request (paginated/prioritized by rating × recency).
- **Validation:** Lat/lng bounds must be valid WGS84; radius capped at 20 km server-side regardless of client request.
- **Acceptance criteria:** Map renders first paint <2s on 4G; panning triggers a debounced refetch (≥500 ms) not a request per frame; clustering count matches actual marker count in cluster.
- **Related data:** `Restaurant`, `Location` (PostGIS point), `RestaurantStatus`.
- **Related API:** `GET /restaurants/nearby`, `GET /restaurants/bounds`.
- **Risk:** Excess marker density causing jank on low-end Android; mitigated via clustering + viewport-limited fetch. **Priority: MVP.**

### 10.3 Search & Filter **[MVP]**

- **Purpose:** Let users find restaurants by name, dish, cuisine, location, or keyword, and narrow by objective filters.
- **Actors:** Guest, Registered User.
- **Preconditions:** None.
- **Main flow:** Enter query or open filter sheet → apply filters (distance, price range, rating, open-now, facilities) → view result list ranked by relevance/composite score → tap result → detail.
- **Exception flow:** No results → suggest relaxing filters, show nearby alternatives; query too short (<2 chars) → no search fired, show recent searches instead.
- **Business rules:** Default sort = composite score (see §8 of brief, "Hệ thống đánh giá"); "open now" filter uses `OpeningHour` + device timezone `Asia/Ho_Chi_Minh`; combining filters is AND, not OR.
- **Validation:** Price range values must be non-negative and min ≤ max; distance filter capped at 20 km.
- **Acceptance criteria:** Filtering returns results in <500 ms p95 for typical urban density; applied filters persist when navigating back from detail.
- **Related data:** `Restaurant`, `Cuisine`, `Dish`, `PriceRange`, `Review`, `RestaurantFacility`, `SearchHistory`.
- **Related API:** `GET /search`, `GET /restaurants` (with query params).
- **Risk:** Naive `ILIKE` search will not scale to Vietnamese diacritics variance — mitigated with `unaccent` + `pg_trgm` (see §07 Tech Stack). **Priority: MVP.**

### 10.4 Restaurant Detail **[MVP]**

- **Purpose:** Give a user everything needed to decide to go, in one screen.
- **Actors:** Guest, Registered User.
- **Preconditions:** Restaurant exists and is not hidden/removed.
- **Main flow:** Open from map/list/search → view photos, name, address, distance, hours, menu, price, phone, facilities, ratings breakdown, reviews, mini-map → act (favorite, call, directions, write review, report).
- **Exception flow:** Restaurant deleted/hidden after being linked (e.g., from a shared link) → "no longer available" state with suggested alternatives nearby.
- **Business rules:** "Open now" badge computed from `OpeningHour` + current time; if a place has 0 reviews, show "Chưa có đánh giá — Hãy là người đầu tiên" instead of a fabricated score.
- **Validation:** N/A (read-heavy screen); write actions validated in their own features.
- **Acceptance criteria:** All core fields render even if optional data (video, detailed menu) is missing, using defined empty states per field.
- **Related data:** `Restaurant`, `Address`, `OpeningHour`, `Menu`, `MenuItem`, `Photo`, `Video`, `RestaurantFacility`, `Review`, `AISummary`.
- **Related API:** `GET /restaurants/:id`.
- **Risk:** Stale hours/menu without a contribution flow erodes trust — mitigated by prominent "Cập nhật thông tin" CTA. **Priority: MVP.**

### 10.5 Review (structured) **[MVP]**

- **Purpose:** Capture trustworthy, multi-criteria feedback that powers ranking and the AI summary.
- **Actors:** Registered User (author), Registered User (reader), Moderator.
- **Preconditions:** User is authenticated; user has not exceeded review rate limits.
- **Main flow:** From detail → "Viết đánh giá" → rate criteria (food quality, space, price, service, hygiene, wifi, parking) → optional overall comment, dishes ordered, bill total, party size, wait time, photos → submit → AI pre-screen → publish or route to moderation.
- **Exception flow:** Duplicate review by same user for same restaurant within 24h → block with message "Bạn đã đánh giá quán này gần đây"; AI flags as high-risk → hold for moderator, user sees "Đang chờ duyệt."
- **Business rules:** One active review per user per restaurant (edits update the same record, versioned); at least 1 criterion + overall rating required; photos optional but capped at 6 per review; edits after 48h keep a public "edited" marker.
- **Validation:** Rating values 1–5 integer per criterion; bill total ≥ 0 and < 50,000,000 VND sanity cap; comment ≤ 2,000 chars.
- **Acceptance criteria:** Submitting a valid review updates the restaurant's composite score within the same request cycle (or async job completing <5s); a rejected review notifies the user with the reason.
- **Related data:** `Review`, `ReviewRating`, `ReviewCriteria`, `Photo`, `ModerationResult`.
- **Related API:** `POST /reviews`, `PATCH /reviews/:id`, `DELETE /reviews/:id`, `POST /reviews/:id/report`.
- **Risk:** Review bombing / fake positive reviews — mitigated by composite scoring (§10.8) and AI moderation (§10.9). **Priority: MVP.**

### 10.6 Add Restaurant (community contribution) **[MVP]**

- **Purpose:** Grow map coverage, especially small/unbranded/street vendors, beyond admin-seeded data.
- **Actors:** Registered User, AI Moderation, Moderator.
- **Preconditions:** User authenticated.
- **Main flow:** "Thêm quán" → pin location (GPS or manual drag) → name, category, cuisine, price range, opening hours, phone (optional), facilities → add ≥1 photo → optional basic menu → submit → status `pending_review` → AI screens → auto-approve (high confidence, low risk) or moderator queue.
- **Exception flow:** Duplicate detection (same name within ~50m) → warn "Có thể quán này đã tồn tại" with link to existing listing, user can confirm "khác quán này" to proceed; submission missing required fields → inline validation blocks submit.
- **Business rules:** Submitted restaurant is invisible on public map until approved; contributor is credited as `submitted_by` for audit/trust scoring (not yet public in MVP); user can see their own pending submissions with status.
- **Validation:** Name 2–120 chars; location must resolve to a valid Vietnam address via reverse geocoding; at least 1 photo required to submit.
- **Acceptance criteria:** A submission with high AI confidence (score below threshold) appears live within seconds without human action; a flagged submission never appears publicly before moderator action.
- **Related data:** `Restaurant` (status=`pending`), `Contribution`, `ModerationResult`, `Address`, `Location`.
- **Related API:** `POST /restaurants`, `GET /me/contributions`.
- **Risk:** Spam/fake listings at scale — mitigated by moderation pipeline + rate limiting per user per day. **Priority: MVP.**

### 10.7 Upload Media **[MVP]**

- **Purpose:** Support photo evidence across reviews and restaurant submissions.
- **Actors:** Registered User.
- **Preconditions:** Authenticated; underlying feature (review/add place) in progress.
- **Main flow:** Capture via camera or pick from gallery → client-side compress/resize → request signed upload URL → upload directly to object storage → confirm → attach reference to parent entity.
- **Exception flow:** Upload fails/network drop → retry with resumable state, show progress and error state; unsupported file type → rejected client-side before upload starts.
- **Business rules:** Max 6 photos per review, 10 per restaurant submission; max file size 8 MB pre-compression, images auto-resized server-side to a max 1920px edge with a generated thumbnail.
- **Validation:** MIME type allow-list (`image/jpeg`, `image/png`, `image/webp`); reject on magic-byte mismatch, not just extension (server-side, security-critical).
- **Acceptance criteria:** A 5 MB photo uploads and displays a thumbnail within 5s on 4G; a corrupted/mislabeled file is rejected server-side even if the client extension looks valid.
- **Related data:** `Photo`, `Video` (schema present, video upload itself is V1).
- **Related API:** `POST /media/upload-url`, `POST /media/confirm`, `DELETE /media/:id`.
- **Risk:** Malicious file upload (polyglot files) — mitigated by magic-byte validation + re-encoding on server, never serving user-uploaded originals directly with executable content types. **Priority: MVP.**

### 10.8 Rating & Composite Score **[MVP]**

- **Purpose:** Prevent a restaurant with 2 five-star reviews from outranking one with 200 reliable reviews.
- **Actors:** System (background job).
- **Preconditions:** At least one published review exists.
- **Main flow:** On review publish/edit/delete → recompute composite score using a Bayesian-average style formula weighted by review count, recency, and (V1+) reviewer trust — detailed formula in §06 ERD / `RestaurantStatus`.
- **Business rules:** Composite score = weighted average pulled toward a global prior mean until a restaurant accumulates enough reviews (minimum votes threshold, e.g., 5) — standard "Bayesian/IMDB-style" damping; recency weight decays reviews older than 12 months.
- **Acceptance criteria:** A restaurant with 2 reviews at 5.0 scores lower than one with 50 reviews averaging 4.6, until the first crosses the minimum-votes threshold and even then stays damped toward the prior.
- **Related data:** `Review`, `ReviewRating`, `RestaurantStatus`.
- **Related API:** internal (triggered by `POST/PATCH/DELETE /reviews`), exposed read-only via `GET /restaurants/:id`.
- **Risk:** Formula must be transparent enough to explain in the AI summary and defend against gaming. **Priority: MVP** (basic formula) — trust-score refinement is **V1/V2**.

### 10.9 AI Moderation (baseline) **[MVP]**

- **Purpose:** Keep contributed content (reviews, submissions, photos) safe and trustworthy without requiring 100% manual review.
- **Actors:** System (AI), Moderator.
- **Preconditions:** New content submitted.
- **Main flow:** Content → AI screening (toxicity, spam, irrelevance, obvious fake/bot patterns, price/menu sanity check) → risk score + reason + label → route: low risk → auto-publish; medium/high risk → moderation queue with AI's reasoning attached → moderator approves/rejects/requests edit → user notified.
- **Exception flow:** AI service unavailable → fail safe to "hold for manual review," never fail-open to auto-publish.
- **Business rules:** AI never hard-deletes content; AI cannot approve content it scored above the medium-risk threshold; every AI decision is logged for audit (`ModerationResult`, `AuditLog`).
- **Validation:** N/A (AI output structured per schema in §25 AI Architecture doc reference).
- **Acceptance criteria:** A review containing profanity is never auto-published; a clean, well-formed review from an established pattern is auto-published in <3s p95.
- **Related data:** `ModerationResult`, `Report`, `AuditLog`.
- **Related API:** internal service, results surfaced via `GET /admin/moderation-queue`.
- **Risk:** False positives frustrating genuine users — mitigated by transparent rejection reasons + edit-and-resubmit flow. **Priority: MVP** (rule/heuristic + single LLM pass); adaptive trust scoring is **V2**.

### 10.10 Favorites **[MVP]**

- **Purpose:** Let users bookmark places to revisit later.
- **Actors:** Registered User.
- **Main flow:** Tap heart icon on card/detail → added to favorites list, instant optimistic UI → view under Profile → Favorites.
- **Business rules:** Favorites are private in MVP (no public "lists" yet — that's V2 "bộ sưu tập quán").
- **Acceptance criteria:** Toggling favorite is reflected instantly client-side and persisted within 1 request; favorite state is consistent across Home, Search, and Detail for the same restaurant.
- **Related data:** `Favorite`.
- **Related API:** `POST /favorites/:restaurantId`, `DELETE /favorites/:restaurantId`, `GET /me/favorites`.
- **Risk:** Low. **Priority: MVP.**

### 10.11 Admin Portal **[MVP]**

- **Purpose:** Give the admin/moderator full control to seed and curate quality data, and run the moderation workflow.
- **Actors:** Admin, Moderator.
- **Main flow:** Admin login (separate, stricter auth) → dashboard (KPIs: pending submissions, pending reviews, reports, active users) → manage restaurants/menus/media/hours/facilities → moderation queue (approve/reject/request edit, sees AI reasoning) → manage reports → manage users (suspend/ban).
- **Business rules:** All admin mutations write to `AuditLog`; role-based — `moderator` role cannot delete users or change roles, only `admin` can.
- **Validation:** Same field-level validation as public contribution forms, plus admin can bypass AI hold with explicit reason (logged).
- **Acceptance criteria:** Every state-changing admin action is traceable to an actor and timestamp in `AuditLog`.
- **Related data:** All entities; primarily `Restaurant`, `ModerationResult`, `Report`, `User`, `AuditLog`.
- **Related API:** `/admin/*` namespace, see §API Specification doc.
- **Risk:** Admin portal is a high-value attack target — mitigated by separate stricter auth, RBAC, IP-agnostic but rate-limited login, audit logging. **Priority: MVP.**

## 11. Out-of-Scope (explicitly not in MVP)

Reel, Story, Livestream, chat/DM, follow/like/comment social graph, booking/reservation, food ordering, payments, vouchers, membership, advertising, affiliate, owner dashboard/analytics, contributor ranking/badges/Food Passport, video upload in reviews (schema present, upload UI deferred), Elasticsearch/OpenSearch (Postgres search suffices at MVP scale), multi-language beyond Vietnamese, multi-country support (architecture allows it, not built).

## 12. Functional Requirements Summary

See §10 for the full template per feature. Consolidated FR list: FR-1 Auth, FR-2 Map/GPS, FR-3 Search/Filter, FR-4 Restaurant Detail, FR-5 Structured Review, FR-6 Add Restaurant, FR-7 Upload Media, FR-8 Composite Scoring, FR-9 AI Moderation, FR-10 Favorites, FR-11 Admin Portal, FR-12 Notifications (system-generated only: moderation results, submission status — no push marketing in MVP), FR-13 Report Content.

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | API p95 < 500 ms for read endpoints under seed-scale data; map first paint < 2s on 4G |
| Availability | Single-region MVP; documented RPO/RTO (see DevOps doc); no formal SLA at portfolio stage |
| Scalability | Modular monolith with clear domain boundaries so modules can be extracted to services later without a rewrite |
| Security | OWASP Top 10 mitigations baseline (see §Security doc); no plaintext secrets; signed media uploads |
| Localization | Vietnamese primary language; VND currency formatting; `Asia/Ho_Chi_Minh` timezone; VN address hierarchy (Tỉnh/Thành → Quận/Huyện → Phường/Xã) |
| Accessibility | Minimum WCAG AA color contrast in design system; dynamic type support; screen-reader labels on interactive elements |
| Compliance | Basic privacy policy, account deletion flow, location data handled per purpose-limitation principle |
| Observability | Structured logs + error monitoring from day one (see DevOps doc) |

## 14. Business Rules (cross-cutting)

1. No content is public the instant it's created if it originates from a non-admin user — always passes through the status pipeline (`pending → auto_approved | in_review → published | rejected`).
2. A user can have exactly one non-deleted review per restaurant; edits are versioned, not duplicated.
3. Composite scores never display with fewer than the minimum-vote threshold implying false confidence — show review count prominently next to the score always.
4. All timestamps stored in UTC, rendered in `Asia/Ho_Chi_Minh`.
5. All monetary values stored as integer VND (no decimal/cents ambiguity).
6. Soft-delete only for user-generated content (reviews, restaurants, photos) to support moderation history and restore; hard-delete reserved for admin-confirmed spam/abuse after retention window.

## 15. Assumptions (explicitly stated, since some inputs were unspecified)

- A1: Solo/small team builds this; "modular monolith" and managed cloud services are prioritized over self-hosted infra to minimize ops burden.
- A2: Initial seed data (30–50 places) is manually curated by the admin (this project's owner), concentrated in 1–2 cities (assume TP. Hồ Chí Minh as primary, given the largest food-scene density) to keep the demo coherent.
- A3: AI provider = an LLM API (e.g., Claude) accessed through an internal `AIGateway` abstraction so the provider can be swapped without touching business logic.
- A4: Push notifications in MVP are limited to transactional (moderation result, submission approved/rejected) — no marketing push infra needed yet.
- A5: No payment processing of any kind touches the MVP; architecture reserves entities/fields but no PCI-scope code is written.
- A6: Legal/ToS/Privacy Policy content is out of scope for engineering deliverables but a placeholder screen/flow is designed (Settings → Privacy Policy).
- A7: A public end-user web app (Next.js, SSR/SSG, SEO/discovery-first — see [07-tech-stack.md](07-tech-stack.md) §5) was added to scope after Phase 1 planning began; it is sequenced as **Phase 1.5**, starting only after the mobile MVP (Phase 1, Modules 1-8) is complete, so it doesn't compete with or delay mobile MVP delivery.

## 16. Risks & Mitigations (product-level)

| Risk | Impact | Mitigation |
|---|---|---|
| Cold start — no reviews, feels empty | High | Admin-seeded 30–50 quality places with real-looking menus/photos/reviews (see Demo Data Plan) |
| Fake/low-quality user reviews once public | High | Composite scoring damping + AI moderation + report flow from day one |
| Solo-dev scope creep into social/AI/monetization | High | Hard MVP boundary enforced in this document; explicit Out-of-Scope list |
| Map performance with growing marker count | Medium | Clustering + viewport-bounded queries + PostGIS spatial index from day one |
| AI cost creep (LLM calls per review/search) | Medium | Cache AI summaries, batch moderation calls, rate-limit AI-powered NL search per user |
