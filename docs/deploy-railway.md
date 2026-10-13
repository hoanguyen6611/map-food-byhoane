# Deploying the backend to Railway

Scope: **backend only**. Postgres (Neon) and ImageKit stay exactly as they
are today — this is purely a compute-layer swap away from Render's free
tier. The only new piece of infrastructure is Redis, added as a Railway
plugin in the same project (BullMQ needs one; see `backend/src/redis/`).

The repo root already ships `railway.json`, pointing Railway at
`backend/Dockerfile` with build context = repo root (the same multi-stage
Docker build this app already uses — see that Dockerfile's own top comment
for why the context can't be `backend/`). Railway auto-detects this file;
no dashboard build configuration is needed as long as the service's **Root
Directory stays unset** (`.`, the repo root) — setting it to `backend/`
would break the build context the Dockerfile depends on.

Two kinds of steps: **[Console]** — Railway's web UI, only you can do this
(needs your account). **[Local]** — nothing to run locally for this one;
it's a dashboard-driven deploy.

## 1. Create the project and connect the repo [Console]

1. <https://railway.app> → **New Project** → **Deploy from GitHub repo** →
   pick this repo.
2. Railway creates one service from the repo. Open its **Settings** tab and
   confirm **Root Directory** is empty/`.` — if Railway auto-set it to
   `backend`, clear it back to the repo root.
3. Under **Settings → Build**, confirm it picked up `railway.json`
   (Builder: Dockerfile, Dockerfile path: `backend/Dockerfile`). If it
   didn't auto-detect, set those two fields manually.

## 2. Add Redis [Console]

1. In the same project: **New** → **Database** → **Add Redis**.
2. That's it — no manual host/port/password wiring needed. Railway exposes
   a `REDIS_URL` variable on the Redis service itself, referenced in step 3
   below.

## 3. Environment variables [Console]

On the backend service → **Variables** tab, add every key from
`backend/env.example`, using your **real production values already
configured on Render today** (copy them straight from Render's dashboard —
Neon's `DATABASE_URL`, the real `JWT_ACCESS_SECRET`, `IMAGEKIT_*` keys,
`ANTHROPIC_API_KEY`, etc. — nothing about those changes with this move).
Two keys get Railway-specific values instead of Render's:

- `REDIS_URL` — **don't** copy Render's value. Use Railway's variable
  reference picker to set this to `${{Redis.REDIS_URL}}` (the Redis plugin
  added in step 2), so it always points at Railway's own instance.
- `PORT` — omit entirely. Railway injects its own `PORT` and
  `backend/src/main.ts` already reads `process.env.PORT` with a fallback,
  so there's nothing to set.

Also update `CORS_ORIGINS` once you know web's/admin-web's deployed
origins (comma-separated, no spaces — see `main.ts`'s `corsOrigins.split(',')`).

## 4. Deploy and verify [Console]

1. Railway deploys automatically once variables are saved (or trigger a
   manual deploy from the service's **Deployments** tab).
2. Once live, Railway shows a generated domain under **Settings →
   Networking** (`*.up.railway.app`) — or add your own custom domain there.
3. Hit `https://<your-railway-domain>/health` — expect
   `{"status":"ok","db":true,"redis":true}`. `db`/`redis`: false means an
   env var is wrong (wrong `DATABASE_URL`, or `REDIS_URL` not wired to the
   reference variable from step 2), not a code issue.

## 5. Point the frontends at the new URL

- `web/.env` (or its host's env config): `BACKEND_API_URL=https://<your-railway-domain>`.
- `admin-web/.env`: `VITE_API_URL=https://<your-railway-domain>`.
- Re-add web's/admin-web's own deployed origins to the backend's
  `CORS_ORIGINS` if you haven't already (step 3) — otherwise browser
  requests from those apps will fail CORS even though `curl`/`/health`
  works fine.

## 6. Decommission Render

Once the frontends are confirmed working against the Railway URL for a
while, delete the Render service. Nothing else to clean up — Neon and
ImageKit were never Render-hosted, so nothing there changes.
