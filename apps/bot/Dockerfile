# FilesDrop Telegram bot — grammY on Bun, long polling against the local
# Telegram Bot API server (filesdrop-tg-api).
#
# Built from the repository root, like the api and web images:
#
#   docker build -t filesdrop-bot:production -f apps/bot/Dockerfile .
#
# Bun installs, type-checks and bundles; the runtime is the slim Bun image with
# nothing but the bundle (grammY and @filesdrop/shared are inlined into it, so
# there is no node_modules at run time). Keep BUN_IMAGE equal to
# `packageManager` in the root package.json.
#
# Secrets (TELEGRAM_BOT_TOKEN, BOT_API_KEY) come from compose at run time.

ARG BUN_IMAGE=oven/bun:1.4.0
ARG BUN_RUNTIME_IMAGE=oven/bun:1.4.0-slim

# ─── deps: the dev tree for bot + shared ───────────────────────────────────────
FROM ${BUN_IMAGE} AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# ─── builder: compile shared, then type-check and bundle the bot ───────────────
FROM deps AS builder
WORKDIR /app
COPY tsconfig.json turbo.json ./
COPY packages/shared/ packages/shared/
COPY apps/bot/ apps/bot/
RUN bun x turbo run build --filter=@filesdrop/bot...

# ─── runtime ───────────────────────────────────────────────────────────────────
FROM ${BUN_RUNTIME_IMAGE} AS runtime
WORKDIR /app
COPY --from=builder /app/apps/bot/dist ./dist

# deploy/refresh.sh prunes superseded images by this label, and only those.
LABEL filesdrop.image=bot

# Non-root. Compose runs it as 101:101 instead, the uid of the local Bot API
# server, so it can read and delete that server's downloads in the shared
# volume (docker/docker-compose.prod.yml).
USER bun
ENV NODE_ENV=production

# `exec` form: bun is PID 1 and gets SIGTERM from `docker stop`.
CMD ["bun", "dist/src/main.js"]
