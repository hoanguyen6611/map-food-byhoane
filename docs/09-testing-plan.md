# Testing Strategy

## 1. Test Pyramid & Tooling by Layer

| Layer | Purpose | Tooling | Owner |
|---|---|---|---|
| Unit test | Pure logic: composite score formula, filter query builders, AI response schema validators, VN phone/address validators | **Jest** (backend + RN shared logic) | Backend/Mobile dev |
| Integration test | Module boundaries against a real Postgres/Redis (via Testcontainers), e.g. `ReviewModule` write → composite score job → read | **Jest + Testcontainers** (ephemeral Postgres/Redis per test run) | Backend dev |
| API test | Contract correctness of REST endpoints: status codes, payload shape, auth/RBAC enforcement, pagination | **Supertest** against a running NestJS test instance; **Postman/Newman** or **Bruno** collections for exploratory + regression suites | Backend/QA |
| Mobile UI test | Component rendering, navigation, state (React Query cache, Zustand store) | **React Native Testing Library** + **Jest** | Mobile dev |
| End-to-end test | Full user journeys across real app + real (test) backend | **Detox** (RN E2E, device/simulator-level) for mobile; **Playwright** for Admin Portal web | QA |
| Security test | OWASP-class checks: injection, auth bypass, upload abuse, rate-limit bypass | **OWASP ZAP** baseline scan against staging API; manual checklist (see [Security section below](#4-security-test-checklist)) | Backend dev/QA |
| Performance test | API latency under load, map query performance at scale | **k6** load scripts against key endpoints (`/restaurants/nearby`, `/search`) | Backend dev |
| Accessibility test | Screen reader labels, contrast, dynamic type | **Expo Accessibility Inspector**, manual VoiceOver/TalkBack pass, automated contrast check in design tokens (Storybook + `axe`) | Mobile dev/Design |
| Usability test | Real-task observation (can a new user find & review a restaurant unassisted?) | Moderated sessions with 5 test users per major flow (guerrilla usability testing) | Product/UX |
| AI moderation test | Precision/recall of risk scoring against a labeled dataset; fail-safe behavior | **Jest** golden-dataset test suite (curated examples of profanity/spam/clean content with expected `riskScore`/`recommendedAction`) + manual adversarial prompts | AI Engineer |
| AI recommendation test | NL query → correct structured filter parsing; explanation quality | **Jest** golden-dataset test suite using the 10 example queries from the brief §9, asserting parsed filter shape; manual relevance review for explanation text | AI Engineer |

## 2. Automation Priority (explicitly required by the brief)

Priority order for building automated coverage first — these are the flows where a regression is most damaging to trust or most likely to recur:

1. **Đăng nhập (Login/Auth)** — API test (all auth endpoints incl. rate limiting) + Detox smoke test (login → Home Map).
2. **Tìm kiếm (Search)** — API test (diacritics-insensitive matching, pagination) + integration test against seeded fixtures.
3. **Bộ lọc (Filter)** — API test (AND-combination correctness, boundary values: price min>max rejected, distance cap enforced).
4. **Bản đồ (Map)** — Integration test on PostGIS query correctness (`ST_DWithin`/bounds) using known seed coordinates with expected result sets; Detox test for pan-triggers-refetch behavior (via network call assertions, not just visual).
5. **Xem chi tiết quán (Restaurant Detail)** — API test for aggregated payload shape incl. all empty-state combinations (no menu, no reviews, no photos).
6. **Thêm quán (Add Restaurant)** — API + integration test for duplicate-detection logic and the full status pipeline (`pending → auto_approved | in_review`).
7. **Viết đánh giá (Write Review)** — API test for validation rules (one review/24h, rating bounds, bill sanity cap) + integration test asserting composite score recompute job fires correctly.
8. **Upload ảnh (Upload Image)** — API test for magic-byte rejection of mislabeled files (security-critical), size cap enforcement, successful thumbnail generation.
9. **Favorite** — API test (idempotent toggle, uniqueness constraint) + RNTL component test for optimistic UI state.
10. **Admin moderation** — API test for RBAC (moderator cannot access admin-only actions), full approve/reject/edit-request flow, and `AuditLog` write verification on every decision.

## 3. Testing by Project Phase

| Phase | What gets tested | Gate to proceed |
|---|---|---|
| Per-sprint (MVP) | Unit + integration + API tests for that sprint's modules (see [08-roadmap-sprint.md](08-roadmap-sprint.md)) | CI green (see DevOps doc) before merge |
| End of Phase 1 (MVP) | Full E2E suite across all P0 user stories; one full security pass; one performance pass against seeded data volume; one accessibility pass; one usability session round | All P0 acceptance criteria in [02-user-stories.md](02-user-stories.md) verified; no open Critical/High security finding |
| Phase 2+ | Regression suite re-run + new-feature-specific tests added incrementally | Same CI gate, expanding coverage, never shrinking it |

## 4. Security Test Checklist (manual, run at end of MVP and before any public/demo deployment)

- [ ] SQL injection attempts against all query-param-driven endpoints (search, filters) — parameterized queries verified, no raw string concatenation.
- [ ] XSS payloads in free-text fields (review comment, restaurant description) rendered safely client-side (RN doesn't execute HTML by default, but Admin web React must escape correctly).
- [ ] JWT tampering (expired token, modified payload, wrong signature) rejected with 401.
- [ ] Rate limiting verified on login, register, forgot-password, review submission, restaurant submission endpoints.
- [ ] File upload: mismatched extension/MIME/magic-bytes rejected; oversized file rejected before full upload commit; executable/script content-types never served back from object storage.
- [ ] RBAC: `moderator` role blocked from admin-only actions (user ban, role change) at the API layer, not just hidden in UI.
- [ ] IDOR check: a user cannot edit/delete another user's review/favorite/contribution by guessing IDs.
- [ ] Secrets never present in mobile app bundle or client-exposed config (checked via bundle inspection).
- [ ] Password reset tokens: single-use, time-limited, invalidated after use — verified by reuse attempt.

## 5. Test Data Strategy

- Unit/integration tests run against ephemeral, seeded fixtures (not the demo dataset) generated per test run for isolation and reproducibility.
- The 30–50 place demo/seed dataset (see [10-portfolio-presentation.md](10-portfolio-presentation.md) Demo Data Plan) is used for E2E, performance, and usability testing specifically *because* it's realistic Vietnamese data — this doubles the seed dataset's value as both a demo asset and a test fixture.
- AI test golden-datasets (moderation + NL recommendation) are versioned alongside code so regressions in prompt/model changes are caught the same way schema regressions are.

## 6. Definition of Done (testing dimension, per feature)

A feature is not "done" until: unit tests cover its pure logic, an integration/API test covers its primary + at least one exception flow from [02-user-stories.md](02-user-stories.md), and — for anything touching money, auth, or moderation — the relevant row in the Security Checklist above is checked.
