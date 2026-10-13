# FilesDrop API — NestJS 11 + Prisma 7 on Node 24.
#
# Built from the repository root, because the workspace (bun.lock, the root
# package.json, packages/shared) is the unit bun installs:
#
#   docker build -t filesdrop-api:production -f apps/api/Dockerfile .
#
# Bun installs and builds; Node runs. Bun is copied in as one static binary from
# the official image rather than installed with `curl | bash`, so the version is
# the tag below and nothing else — keep it equal to `packageManager` in the root
# package.json, or `bun install --frozen-lockfile` refuses the lockfile.
#
# At start the container applies pending migrations (`prisma migrate deploy`)
# and then execs the server. One replica, so there is no migration race to
# guard against; a migration that fails stops the container before it serves.

ARG BUN_IMAGE=oven/bun:1.4.0
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${BUN_IMAGE} AS bun

# ─── os: what every stage, including the runtime, stands on ────────────────────
# openssl is here and not only in the runtime because Prisma picks its schema
# engine build by probing for it AT INSTALL TIME. Without it the install stage
# guesses `debian-openssl-1.1.x`, the runtime (which has openssl 3) asks for
# `debian-openssl-3.0.x`, tries to download it into a root-owned node_modules,
# and `migrate deploy` dies with "Can't write to /app/node_modules/@prisma/engines".
FROM ${NODE_IMAGE} AS os
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM os AS toolchain
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# ─── deps: the whole dev tree for api + shared ─────────────────────────────────
# Only the manifests first, so this layer is reused until a dependency changes.
# apps/web is left out on purpose: the api image has no use for Next, and bun
# installs a partial workspace against the same lockfile without rewriting it.
FROM toolchain AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# ─── builder: generate the Prisma client, compile shared and api ───────────────
FROM deps AS builder
WORKDIR /app
COPY tsconfig.json turbo.json ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
# prisma.config.ts calls env('DATABASE_URL'), which throws when it is unset.
# `generate` never connects, so a placeholder is enough; the real URL only
# exists at run time, in the compose environment.
RUN cd apps/api \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build bun run db:generate
RUN bun x turbo run build --filter=@filesdrop/api...

# ─── prod-deps: runtime node_modules, plus the Prisma CLI ──────────────────────
# `prisma` is a devDependency in apps/api/package.json, but the container runs
# `prisma migrate deploy` at start, so this stage promotes it to a dependency
# before the production install. The version is the one package.json pins
# exactly, so this is the same CLI that wrote the migrations.
FROM toolchain AS prod-deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN node -e "\
const fs = require('fs'); \
const file = 'apps/api/package.json'; \
const pkg = JSON.parse(fs.readFileSync(file, 'utf8')); \
const version = pkg.devDependencies && pkg.devDependencies.prisma; \
if (!version) { console.error('apps/api/package.json has no prisma devDependency'); process.exit(1); } \
pkg.dependencies.prisma = version; \
fs.writeFileSync(file, JSON.stringify(pkg, null, 2)); \
console.log('runtime prisma CLI: ' + version); \
"
RUN bun install --production
# The generated client lives in node_modules/.prisma, so it has to be generated
# into THIS tree, not copied from the builder's.
COPY apps/api/prisma/ apps/api/prisma/
COPY apps/api/prisma.config.ts apps/api/
RUN cd apps/api \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build node /app/node_modules/prisma/build/index.js generate

# ─── runtime ───────────────────────────────────────────────────────────────────
# No bun here: it builds, node runs.
FROM os AS runtime
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Uploaded bytes. A named volume is mounted here in production; docker copies
# this directory's ownership into an empty volume on first mount, which is how
# the volume ends up writable by `node` without a root entrypoint.
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data

# deploy/refresh.sh prunes superseded images by this label, and only those.
LABEL filesdrop.image=api

USER node
WORKDIR /app/apps/api
ENV NODE_ENV=production \
    PORT=7347 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1
EXPOSE 7347

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||7347)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `exec` so node is PID 1's direct replacement and receives SIGTERM from
# `docker stop` instead of the shell swallowing it.
CMD ["sh", "-c", "node /app/node_modules/prisma/build/index.js migrate deploy && exec node dist/src/main"]
