# FilesDrop web — Next.js 16 standalone server on Node 24.
#
# Built from the repository root:
#
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://filesdrop-api.luna-realm.com \
#     --build-arg NEXT_PUBLIC_WEB_URL=https://filesdrop.luna-realm.com \
#     -t filesdrop-web:production -f apps/web/Dockerfile .
#
# NEXT_PUBLIC_* are inlined into the client bundle by `next build`, so they are
# build arguments, not run-time environment: setting them on the container
# changes what the server renders and nothing the browser runs. An image built
# with the wrong API origin has to be rebuilt, not reconfigured — which is why
# the builder refuses to start without them rather than baking in "undefined".
#
# API_INTERNAL_URL (server-side fetches to http://filesdrop-api:7347) is read at
# run time and comes from compose.

ARG BUN_IMAGE=oven/bun:1.4.0
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${BUN_IMAGE} AS bun

# ─── deps: the dev tree for web + shared ───────────────────────────────────────
# apps/api is left out: the web app never imports it (CLAUDE.md — it talks to
# the API over HTTP), and Prisma has no business in this image.
FROM ${NODE_IMAGE} AS deps
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock bunfig.toml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# ─── builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" \
  || (echo "NEXT_PUBLIC_API_URL build arg is required — the client bundle bakes it in." && exit 1)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_WEB_URL
RUN test -n "$NEXT_PUBLIC_WEB_URL" \
  || (echo "NEXT_PUBLIC_WEB_URL build arg is required — the client bundle bakes it in." && exit 1)
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}

ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.json turbo.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN bun x turbo run build --filter=@filesdrop/web...
# `public/` is optional in Next and does not exist yet; COPY in the runtime
# stage cannot be conditional, so make sure there is always something to copy.
RUN mkdir -p apps/web/public

# ─── runtime ───────────────────────────────────────────────────────────────────
# The standalone output is traced from the repository root (outputFileTracingRoot
# in next.config.ts), so it carries the workspace layout: server.js sits at
# apps/web/server.js and the node_modules it actually imports sit at the root.
# Static assets and public/ are not part of the trace and are copied beside it,
# where server.js looks for them.
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4747 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
# The image cache Next writes at run time.
RUN mkdir -p /app/apps/web/.next/cache && chown -R node:node /app/apps/web/.next

# deploy/refresh.sh prunes superseded images by this label, and only those.
LABEL filesdrop.image=web

USER node
EXPOSE 4747

# Any answer below 500 is healthy: `/` redirects to a locale once i18n lands,
# and a redirect is a server that works.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4747)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
