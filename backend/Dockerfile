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
COPY . .
RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build --workspace=backend

# Slim runtime image — only what `node dist/main` actually needs at runtime.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Same reason as the build stage above — the engine binary needs OpenSSL
# present at runtime too, not just at generate-time.
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
