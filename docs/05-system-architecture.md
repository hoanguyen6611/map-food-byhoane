# System Architecture

Full technology rationale lives in [07-tech-stack.md](07-tech-stack.md); this document focuses on structure and data flow.

## 1. Architecture Style: Modular Monolith

**Decision:** one deployable backend service, internally organized into strict domain modules with enforced boundaries (no cross-module direct DB access), not a microservices mesh.

**Why (per project rule "không xây dựng microservices nếu chưa thật sự cần thiết"):**
- Solo/small-team velocity: one codebase, one deploy pipeline, one database to operate.
- Microservices add network latency, distributed transactions, service discovery, and multi-repo ops overhead — none of which this stage needs.
- A modular monolith with clean module boundaries (enforced via NestJS module system + lint rules against cross-module imports) can be split into services later **only where it earns its cost** (e.g., AI/moderation pipeline first, since it's the most independently scalable and swappable piece).

| | Modular Monolith | Microservices |
|---|---|---|
| Dev speed (solo/small team) | High | Low (infra tax) |
| Operational cost | 1 service, 1 DB | N services, N deploys, service mesh |
| Consistency (transactions) | Native DB transactions | Distributed transaction complexity |
| Future extraction | Possible, boundary-dependent | N/A (already split) |
| Portfolio narrative | "I know when *not* to over-engineer" | Often reads as resume-driven design |

## 2. High-Level Diagram

```mermaid
flowchart TB
  subgraph Clients
    RN[React Native App - iOS/Android]
    AdminWeb[Admin Portal - Web SPA]
  end

  subgraph Edge
    CDN[CDN / Object Storage CDN for media]
    LB[Load Balancer / Reverse Proxy]
  end

  subgraph Backend["NestJS Modular Monolith (Node.js/TypeScript)"]
    Gateway[API Gateway Layer - REST]
    AuthMod[Auth Module]
    RestaurantMod[Restaurant Module]
    SearchMod[Search Module]
    ReviewMod[Review Module]
    MediaMod[Media Module]
    ContribMod[Contribution Module]
    ModerationMod[Moderation Module]
    NotifMod[Notification Module]
    AdminMod[Admin Module]
    AIGateway[AI Gateway - provider-agnostic interface]
  end

  subgraph Data
    PG[(PostgreSQL + PostGIS)]
    Redis[(Redis - cache, rate limit, queue)]
    S3[(Object Storage - S3-compatible)]
  end

  subgraph External
    LLM[LLM Provider API]
    OAuthP[Google / Apple OAuth]
    Geocode[Geocoding Service]
    PushSvc[Push Notification Service]
  end

  RN --> LB
  AdminWeb --> LB
  LB --> Gateway
  Gateway --> AuthMod & RestaurantMod & SearchMod & ReviewMod & MediaMod & ContribMod & ModerationMod & NotifMod & AdminMod

  AuthMod --> PG
  AuthMod --> OAuthP
  RestaurantMod --> PG
  SearchMod --> PG
  SearchMod --> Redis
  ReviewMod --> PG
  ContribMod --> PG
  ContribMod --> Geocode
  ModerationMod --> AIGateway
  ModerationMod --> PG
  AIGateway --> LLM
  MediaMod --> S3
  MediaMod --> Redis
  NotifMod --> PushSvc
  RN --> CDN
  CDN --> S3

  BackgroundJobs[Background Job Workers - BullMQ] --> PG
  BackgroundJobs --> Redis
  BackgroundJobs --> AIGateway
  ModerationMod --> BackgroundJobs
  RestaurantMod --> BackgroundJobs
```

## 3. Module Boundaries (Backend)

| Module | Responsibility | Owns tables (primary) |
|---|---|---|
| `AuthModule` | Registration, login, OAuth, tokens, sessions | `User`, `Role`, `Permission` |
| `UserModule` | Profile, preferences, favorites | `UserProfile`, `Favorite` |
| `RestaurantModule` | Restaurant CRUD, menu, hours, facilities, status | `Restaurant`, `Address`, `Location`, `OpeningHour`, `RestaurantFacility`, `Menu`, `MenuItem`, `Dish`, `Cuisine`, `RestaurantCategory`, `PriceRange`, `RestaurantStatus`, `CrowdedStatus`, `SeatAvailability`, `PowerOutletStatus`, `ParkingInformation` |
| `SearchModule` | Query parsing, filter application, ranking | reads across `Restaurant*` (no ownership), owns `SearchHistory` |
| `ReviewModule` | Review CRUD, criteria ratings, composite scoring | `Review`, `ReviewRating`, `ReviewCriteria` |
| `MediaModule` | Signed upload URLs, image processing pipeline, thumbnails | `Photo`, `Video` |
| `ContributionModule` | Community add/edit submissions, versioning | `Contribution`, `EditSuggestion` |
| `ModerationModule` | AI screening orchestration, moderator decisions, reports | `ModerationResult`, `Report` |
| `NotificationModule` | Transactional notifications | `Notification` |
| `AIModule` (a.k.a. AI Gateway) | Provider-agnostic interface to LLM: moderation scoring, NL query parsing, summary generation | `AIRecommendation`, `AISummary` |
| `AdminModule` | Composition layer over other modules with elevated RBAC + audit | `AuditLog` |

**Rule enforced in code:** a module may only reach another module's tables through that module's exported service — never a raw repository import across module boundaries. This is the seam microservice extraction would later cut along.

## 4. AI Gateway Design (provider-agnostic, per project rule)

```mermaid
flowchart LR
  ModerationMod --> AIGateway
  SearchMod -. NL query parsing .-> AIGateway
  RestaurantMod -. AI summary trigger .-> AIGateway
  AIGateway --> Adapter1[Anthropic Claude Adapter]
  AIGateway -.future.-> Adapter2[Alternate LLM Adapter]
  Adapter1 --> ClaudeAPI[(Claude API)]
```

- All AI calls go through one internal interface (`AIGateway.moderate()`, `.parseQuery()`, `.summarize()`), each returning a strictly-typed structured result (JSON schema-validated), never raw model text passed on to business logic.
- Provider is swappable behind this interface; MVP ships one adapter (see Tech Stack doc for provider choice and reasoning).
- Every AI call and its structured output is persisted (`ModerationResult`, `AISummary`, `AIRecommendation`) for auditability and to avoid recomputation (caching).

## 5. Data Flow: Contribution → Moderation (reference flow for §06 Moderation Workflow)

```mermaid
sequenceDiagram
  participant U as User (App)
  participant API as Backend API
  participant AI as AI Gateway
  participant DB as PostgreSQL
  participant Q as Job Queue (BullMQ)
  participant M as Moderator (Admin Portal)

  U->>API: POST /reviews (or /restaurants)
  API->>DB: insert with status=pending
  API->>Q: enqueue moderation job
  API-->>U: 202 Accepted (status=pending)
  Q->>AI: moderate(content)
  AI-->>Q: {riskScore, labels, reason}
  Q->>DB: write ModerationResult
  alt riskScore below auto-approve threshold
    Q->>DB: update status=published
    Q->>U: notification "Đã đăng"
  else riskScore requires review
    Q->>DB: update status=in_review
    M->>API: GET /admin/moderation-queue
    M->>API: POST decision (approve/reject/edit)
    API->>DB: update status, write AuditLog
    API->>U: notification with result/reason
  end
```

## 6. Geospatial Query Path

- `Location` stored as PostGIS `geography(Point, 4326)`.
- Nearby query uses `ST_DWithin` with a GIST index for radius search; viewport query uses `ST_MakeEnvelope` + `&&` bounding-box operator for fast index-assisted pans.
- Redis caches hot viewport tiles (keyed by rounded bounds + filter hash) for a short TTL (e.g., 30–60s) to absorb rapid pan/zoom traffic without hammering Postgres.

## 7. Search Path (MVP — no separate search engine)

- MVP search runs on PostgreSQL directly using `pg_trgm` (fuzzy/typo-tolerant match) + `unaccent` (diacritics-insensitive Vietnamese matching) + a `tsvector` generated column for full-text ranking across name/description/dish names.
- This is intentionally **not** Elasticsearch/OpenSearch at MVP scale (30–50 to low-thousands of rows) — introducing a second search datastore before it's needed would violate the "no over-engineering" rule. Migration path to OpenSearch is documented as a **V2 trigger** in the Tech Stack doc once catalog size / query complexity justifies it.

## 8. Caching Strategy

| Data | Cache | TTL | Invalidation |
|---|---|---|---|
| Viewport marker queries | Redis | 30–60s | Time-based only (cheap to recompute) |
| Restaurant detail (read-heavy) | Redis | 5 min | On any write to that restaurant's core fields |
| Composite score | Stored column (materialized), recomputed on review write | N/A | Recomputed via job on review create/update/delete |
| AI Summary | Stored (`AISummary` table) | Regenerated on a schedule/threshold (e.g., every N new reviews or 7 days) | Not regenerated per request — too costly |
| Auth rate limiting | Redis (sliding window counter) | per-endpoint | N/A |

## 9. Deployment Topology (MVP, cost-optimized — detail in DevOps doc)

```mermaid
flowchart LR
  subgraph "Managed Cloud (single region - ap-southeast, e.g. Singapore)"
    App[NestJS API - container, 1-2 instances]
    Worker[BullMQ Worker - container]
    PGManaged[(Managed PostgreSQL + PostGIS)]
    RedisManaged[(Managed Redis)]
    ObjStorage[(S3-compatible Object Storage + CDN)]
  end
  Mobile[React Native App] --> App
  AdminSPA[Admin Web SPA] --> App
  App --> PGManaged
  App --> RedisManaged
  Worker --> PGManaged
  Worker --> RedisManaged
  App --> ObjStorage
```

## 10. Extension Points (designed now, not built now)

- `Restaurant.ownerId` (nullable FK to `User`) + `Role: owner` reserved for Phase 4 claim/owner-dashboard features — no code path uses it in MVP.
- `PriceRange`/`MenuItem` schema supports a future `Order`/`Booking` entity attaching without migration surgery.
- `AIRecommendation` log table doubles as the training/eval dataset for future personalization (Phase 3), and as the audit trail for "why was this suggested" disputes.
- Notification module is built against an abstract `NotificationChannel` interface so push/email/in-app can be added independently later.
