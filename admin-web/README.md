# Admin Web — The Food Map of Vietnam

React + Vite + TypeScript admin portal skeleton (Module 1 — Foundations & Scaffolding). This is
scaffolding only: routing, layout shell, React Query, and a typed API client stub. Real screen
logic, auth, and business rules arrive in later build-prompt modules.

## Stack

- React 19 + TypeScript (strict mode) + Vite
- React Router (`react-router-dom`) for client-side routing
- TanStack Query (`@tanstack/react-query`) for server state
- `@foodmap/shared-types` (npm workspace package) for DTOs shared with the backend/mobile apps

## Routes

| Path           | Page                        | Screen ref (docs/04-screen-list.md) |
| -------------- | ---------------------------- | ------------------------------------ |
| `/login`       | Admin Login                  | §28 (no layout shell)                |
| `/`            | Admin Dashboard               | §29                                   |
| `/restaurants` | Admin Restaurant Management    | §30                                   |
| `/moderation`  | Admin Moderation Queue         | §31                                   |
| `/reviews`     | Admin Review Management        | §32                                   |
| `/users`       | Admin User Management          | §33                                   |

All routes except `/login` render inside the shared shell (`src/layout/AppLayout.tsx`): a sidebar
with links to the 5 non-login routes, plus a header.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` is the base URL of the backend API (see `src/api/client.ts`).

> Note: `.env.example` could not be written by the scaffolding agent due to a sandbox permission
> restriction on `.env*` files. Create `admin-web/.env.example` manually with the single line
> above before running `npm run dev` against a real backend.

## Getting started

This app is part of the repo's npm workspaces setup (see root `package.json`). From the repo
root, after `npm install` has been run once at the root:

```bash
npm run dev:admin
```

Or, working directly inside `admin-web/`:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) and build for production
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build locally

## Structure

```text
src/
  api/        API client (fetch wrapper) + React Query client instance
  layout/     Shared shell (sidebar + header) wrapping non-login routes
  pages/      One placeholder component per admin screen (28-33)
  App.tsx     Route definitions
  main.tsx    App entry point (QueryClientProvider + BrowserRouter)
```
