# Module 1 — Foundations & Scaffolding

## Context

We are building "The Food Map of Vietnam," a Vietnam-first food discovery platform. Full product design lives in `/docs` at the repo root — read `docs/05-system-architecture.md` and `docs/07-tech-stack.md` in full before writing any code; they contain the locked architecture and stack decisions this module must follow exactly (do not re-decide framework/database choices).

This is Module 1 of 8 (see `docs/build-prompts/00-how-to-use.md`). It produces no user-facing feature — it produces the skeleton every later module builds on. Do not implement any business logic (no auth, no restaurant CRUD) in this module; that starts in Module 2.

## Scope

### 1. Repository structure
Set up a monorepo with three deployable apps + one shared package:
```
/backend       — NestJS API (modular monolith per docs/05)
/mobile        — React Native app (Expo)
/admin-web     — React (Vite) admin portal
/packages/shared-types — TypeScript types/DTOs shared between backend, mobile, admin-web
/docs          — already exists, do not restructure it
```
Use npm/pnpm workspaces (pick one, document the choice in the root README) to link `shared-types` into the other three without publishing to a registry.

### 2. Backend skeleton (NestJS)
- Initialize a NestJS project in `/backend` with TypeScript strict mode on.
- Create empty module shells (folder + `*.module.ts` only, no business logic yet) for every module named in `docs/05-system-architecture.md` §3: `AuthModule`, `UserModule`, `RestaurantModule`, `SearchModule`, `ReviewModule`, `MediaModule`, `ContributionModule`, `ModerationModule`, `NotificationModule`, `AIModule`, `AdminModule`. Wire them all into `AppModule` so the app boots even though they're empty.
- Add global setup: `ValidationPipe` (whitelist + forbidNonWhitelisted), a global exception filter returning a consistent error shape (`{statusCode, message, error}`), request logging middleware (structured JSON logs), and CORS configured for the mobile/admin origins.
- Add a `/health` endpoint returning `{status: "ok", db: boolean, redis: boolean}`.
- Set up TypeORM or Prisma (pick one — Prisma is recommended for its migration ergonomics and TS-first schema; if you choose TypeORM instead, document why in a short ADR comment) connected to PostgreSQL.
- Enable the `postgis`, `pg_trgm`, and `unaccent` Postgres extensions via migration.

### 3. Database migrations (Identity + Restaurant Core only, from docs/06-database-erd.md)
Implement migrations for exactly these entities (§2 and §3 of the ERD doc) — do not implement Review/Media/Moderation/Contribution tables yet, those arrive in their own modules:
`User`, `UserProfile`, `Role`, `Permission`, `RolePermission`, `Restaurant`, `RestaurantStatus`, `RestaurantCategory`, `Cuisine`, `RestaurantCuisine`, `Dish`, `Menu`, `MenuItem`, `PriceRange`, `Address`, `Location`, `OpeningHour`, `RestaurantFacility`.

Follow the field tables in `docs/06-database-erd.md` exactly: types, nullability, unique constraints, indexes (including the GIST index on `Location.geoPoint` and the GIN trigram index on `Restaurant.name`), and enum values as specified. Seed `Role` (`guest`,`user`,`moderator`,`admin`,`owner`), `Permission` (a minimal starter set covering what's referenced in later docs), `RestaurantCategory`, `Cuisine`, and `PriceRange` catalog rows via a seed script — these are reference data, not user data.

### 4. Local dev environment
- `docker-compose.yml` at repo root running: Postgres (with PostGIS image), Redis. Backend runs locally against these (not containerized itself yet, to keep iteration fast) — document both modes (local + containerized) in the README.
- `.env.example` files for backend, mobile, admin-web with every variable referenced in code (DB connection string, Redis URL, JWT secrets placeholders, AI API key placeholder) — never commit a real `.env`.

### 5. Mobile skeleton (React Native + Expo)
- `npx create-expo-app` in `/mobile` with TypeScript template.
- Set up React Navigation with an empty stack matching the top-level sitemap in `docs/03-sitemap-userflow.md` (screens can be placeholder components with just a title text) — this validates the navigation structure early, even before real screens exist.
- Add React Query and a minimal API client (typed against `shared-types`) pointed at the local backend.
- Confirm the app boots on both iOS simulator and Android emulator (or document if only one was verified due to environment constraints).

### 6. Admin web skeleton (React + Vite)
- `npm create vite@latest` in `/admin-web` with React + TypeScript template.
- Set up routing (React Router) with empty placeholder pages for Admin Login, Dashboard, Restaurant Management, Moderation Queue, Review Management, User Management (per `docs/04-screen-list.md` §28-33).
- Add React Query + typed API client sharing `shared-types` with the mobile app.

### 7. CI skeleton
- GitHub Actions workflow that: installs dependencies, runs lint, runs `tsc --noEmit` for each app, runs backend unit tests (even if there are none yet, the job must exist and pass on an empty suite) — this is the gate every later module's tests plug into (see `docs/09-testing-plan.md`).

## Explicitly out of scope for this module
No authentication logic, no restaurant business logic, no UI beyond navigation shells, no deployment/hosting setup (that's the DevOps doc's concern, not this module).

## Definition of Done
- [ ] `docker compose up` starts Postgres+Redis cleanly.
- [ ] `cd backend && npm run start:dev` boots the API, `/health` returns `{status: "ok", db: true, redis: true}`.
- [ ] Migrations run clean against a fresh database (`npm run migration:run` or Prisma equivalent), seed script populates Role/Permission/RestaurantCategory/Cuisine/PriceRange.
- [ ] `cd mobile && npx expo start` boots the app and navigating between placeholder screens works per the sitemap structure.
- [ ] `cd admin-web && npm run dev` boots the admin shell with routing between placeholder pages working.
- [ ] CI workflow passes on a clean push (lint + typecheck + empty test suite).
- [ ] Root README updated with setup instructions for all three apps + Docker Compose.
