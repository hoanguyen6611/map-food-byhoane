# Multi-stage production build for the public Next.js app. Build context
# MUST be the repo root (not web/) — this is an npm workspaces monorepo and
# `web` depends on packages/shared-types via a symlink npm creates in the
# root node_modules, so `npm ci` needs every workspace's package.json
# present. Same reasoning as backend/Dockerfile's top comment.
#
# Deploy with: `fly deploy --config web/fly.toml --dockerfile web/Dockerfile`
# run from the REPO ROOT, not from inside web/ — see docs/deploy-flyio.md.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin-web/package.json admin-web/package.json
COPY mobile/package.json mobile/package.json
COPY web/package.json web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Same nested-dependency caveat as backend/Dockerfile — npm workspaces
# doesn't always hoist every package to the root node_modules.
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time, not
# read at runtime — must be passed as build args. Anything server-only
# (BACKEND_API_URL, etc.) is read from the runtime environment instead and
# does NOT need to be here.
ARG NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
ARG NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
ARG NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
ARG NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID
ARG NEXT_PUBLIC_APPLE_REDIRECT_URI
ENV NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=$NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
ENV NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=$NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
ENV NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
ENV NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID=$NEXT_PUBLIC_APPLE_OAUTH_CLIENT_ID
ENV NEXT_PUBLIC_APPLE_REDIRECT_URI=$NEXT_PUBLIC_APPLE_REDIRECT_URI
RUN npm run build --workspace=web

# Slim runtime image. `output: 'standalone'` (next.config.ts) produces a
# pruned `.next/standalone` tree with only the node_modules this app's
# server actually needs — in a workspace monorepo, Next nests it under the
# path from the detected workspace root to this app (`web/`), so the
# server entrypoint ends up at `/app/web/server.js`, not `/app/server.js`.
# Static assets and `public/` are traced separately and must be copied in
# by hand (documented Next.js monorepo Docker pattern).
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./web/.next/static
COPY --from=build /app/web/public ./web/public

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
CMD ["node", "web/server.js"]
