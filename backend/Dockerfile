# Multi-stage production build for the NestJS backend. Build context MUST
# be the repo root (not backend/) — this is an npm workspaces monorepo and
# the backend depends on packages/shared-types via a symlink npm creates in
# the root node_modules, so `npm ci` needs every workspace's package.json
# present and the build stage needs the real packages/shared-types source
# (type-only imports, erased at compile time, but still type-checked by
# `nest build`). See docker-compose.prod.yml for the `build.context: .`
# wiring and docs/deploy-oracle-cloud.md for the full deploy runbook.

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
# Alpine ships no OpenSSL by default; Prisma's engine binary can't detect a
# version to target without it and silently defaults to the wrong one
# (openssl-1.1.x, which this Alpine doesn't have), failing at runtime with
# "Error loading shared library libssl.so.1.1". Installing it here makes
# `prisma generate` fetch the engine matching what's actually on the image.
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
# npm workspaces doesn't always hoist every dependency to the root
# node_modules — a version conflict can force npm to nest a package inside
# the workspace that needs it instead (e.g. expo-server-sdk ends up at
# backend/node_modules/expo-server-sdk, not node_modules/expo-server-sdk).
# The line above alone silently drops any such nested package, breaking
# `nest build`'s module resolution with a "Cannot find module" TS2307 even
# though `npm ci` installed it correctly in the deps stage.
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build --workspace=backend
# packages/shared-types ships raw .ts source as its `main` (so every other
# workspace's dev server picks up an edit instantly, no rebuild step) — fine
# for ts-node/bundler-based consumers, but the runtime stage below just runs
# plain `node dist/main.js`, and recent Node versions' native ESM/type-strip
# handling of a raw .ts entry point fails to resolve this package's own
# extensionless relative exports (`export * from './common'` etc.) with
# ERR_MODULE_NOT_FOUND — real incident, not hypothetical. Compiling it here
# and pointing the RUNTIME-ONLY copy of its package.json at the compiled JS
# (see the runtime stage) sidesteps that entirely; the repo's own
# packages/shared-types/package.json is never touched, so local dev is unaffected.
RUN npm run build --workspace=packages/shared-types

# Slim runtime image — only what `node dist/main` actually needs at runtime.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Same reason as the build stage above — the engine binary needs OpenSSL
# present at runtime too, not just at generate-time.
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
# Same nested-dependency caveat as the build stage above — a package not
# hoisted to the root node_modules must be copied from its actual workspace
# location too, or it's missing at runtime even though the build succeeded.
COPY --from=build /app/backend/node_modules ./backend/node_modules
# Only the compiled output, not the raw `src` — see the build stage's
# comment above for why. This package.json is a minimal runtime-only stand-in
# (never committed, never affects local dev), pointing `main`/`types` at the
# compiled JS instead of the repo's own package.json's raw-source `main`.
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
RUN printf '{"name":"@foodmap/shared-types","version":"0.1.0","main":"dist/index.js","types":"dist/index.d.ts"}' > ./packages/shared-types/package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
