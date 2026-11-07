# Multi-stage build for the admin SPA. Build context MUST be the repo root
# (not admin-web/) — same npm workspaces reasoning as backend/Dockerfile and
# web/Dockerfile: `npm ci` needs every workspace's package.json present.
#
# Deploy with: `fly deploy --config admin-web/fly.toml --dockerfile admin-web/Dockerfile`
# run from the REPO ROOT — see docs/deploy-flyio.md.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin-web/package.json admin-web/package.json
COPY mobile/package.json mobile/package.json
COPY web/package.json web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci
COPY . .
# Vite inlines `import.meta.env.VITE_*` into the built JS at compile time —
# there's no "runtime env" for a static SPA, so this must be a build arg,
# not a container env var set at deploy/run time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=admin-web

# Static output served by nginx — no Node runtime needed once built.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/admin-web/dist /usr/share/nginx/html
COPY admin-web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
