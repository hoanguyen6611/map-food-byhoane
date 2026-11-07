# Deploying web + admin-web to Fly.io

Scope: **web (public Next.js app) and admin-web (Vite admin SPA) only**.
Backend stays on Railway, Postgres (Neon) and ImageKit stay as they are —
this only replaces Vercel/Netlify as the hosting layer for the two frontend
apps, so they can run side by side with the existing Vercel/Netlify deploys
during the switch.

The repo now ships `web/Dockerfile` + `web/fly.toml` and
`admin-web/Dockerfile` + `admin-web/fly.toml`. Both Dockerfiles need the
**repo root** as build context (same npm-workspaces reasoning as
`backend/Dockerfile`) — every command below is run from the repo root, not
from inside `web/` or `admin-web/`.

Two kinds of steps: **[Console/CLI]** — only you can do this (Fly account,
`flyctl` installed locally). **[Local]** — already done, part of this change.

## 0. Install flyctl and log in [CLI]

```
curl -L https://fly.io/install.sh | sh
fly auth login
```

## 1. Create the two apps [CLI]

App names in `web/fly.toml` (`foodmap-web`) and `admin-web/fly.toml`
(`foodmap-admin`) are placeholders — Fly app names are globally unique, so
if either is taken, edit the `app = "..."` line in that `fly.toml` first.

```
fly apps create foodmap-web
fly apps create foodmap-admin
```

## 2. Set runtime secrets [CLI]

These are read from `process.env` **at runtime** (unlike the `NEXT_PUBLIC_*`/
`VITE_*` ones below, which get baked into the build) — set with `fly
secrets set`, never written to `fly.toml` (which is committed to git):

```
fly secrets set -a foodmap-web \
  BACKEND_API_URL=https://<your-railway-domain> \
  IMAGEKIT_PRIVATE_KEY=<value from web/.env today> \
  REVALIDATE_SECRET=<value from web/.env today> \
  SITE_URL=https://<your-fly-web-domain-or-custom-domain>
```

`admin-web` has no runtime secrets — it's a static SPA; its only env var
(`VITE_API_URL`) is baked in at build time (next step).

## 3. Deploy [CLI]

Build-time args become the actual baked-in values for every
`NEXT_PUBLIC_*`/`VITE_*` variable the code reads — copy these from your
current `web/.env` / `admin-web/.env`:

```
# from the repo root
fly deploy --config web/fly.toml \
  --build-arg NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=<value> \
  --build-arg NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=<value> \
  --build-arg NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=<value> \
  --build-arg NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID=<value> \
  --build-arg NEXT_PUBLIC_APPLE_REDIRECT_URI=<value>

fly deploy --config admin-web/fly.toml \
  --build-arg VITE_API_URL=https://<your-railway-domain>
```

If `fly deploy` ever complains it can't find `web/Dockerfile` or includes
the wrong files, double check you ran it from the repo root — the
`--dockerfile` path and the `COPY` paths inside both Dockerfiles are
root-relative on purpose.

## 4. Verify [CLI]

```
fly status -a foodmap-web
fly status -a foodmap-admin
curl -I https://foodmap-web.fly.dev/
curl -I https://foodmap-admin.fly.dev/
```

Open both URLs, confirm pages render and login/OAuth buttons work (proves
the `NEXT_PUBLIC_*` build args landed correctly — a blank/broken OAuth
button means one was missed in step 3).

## 5. Point the backend's CORS at the new origins [Console]

On Railway's backend service → Variables → `CORS_ORIGINS`, add the Fly
domains (or your custom domains once attached) alongside the existing
Vercel/Netlify ones — comma-separated, no spaces. Needed even though
`curl`/`/health` works fine, since that check bypasses the browser's CORS
preflight entirely.

## 6. Custom domains (optional) [CLI]

```
fly certs add -a foodmap-web www.yourdomain.com
fly certs add -a foodmap-admin admin.yourdomain.com
```

Then add the CNAME/A records Fly prints out at your DNS provider.

## 7. Decommission Vercel/Netlify

Once both Fly URLs are confirmed working for a while (and custom domains,
if any, are cut over), delete the Vercel/Netlify projects. Remember to also
remove their origins from `CORS_ORIGINS` once nothing calls through them
anymore.

## Notes

- Both apps run with `min_machines_running = 0` / `auto_stop_machines =
  "stop"` — Fly suspends the machine when idle and cold-starts it on the
  next request (cheapest option). If that cold-start latency is
  unacceptable, set `min_machines_running = 1` in the relevant `fly.toml`
  (small always-on cost).
- `web`'s Dockerfile adds `sharp` (web/package.json) — required for
  `next/image`'s production image optimization when self-hosting; Vercel
  provided this for free, Fly does not.
- `web/next.config.ts` now sets `output: 'standalone'` — this is required
  for the Dockerfile's slim runtime stage to work at all; don't remove it
  without also rewriting `web/Dockerfile`'s runtime stage.
