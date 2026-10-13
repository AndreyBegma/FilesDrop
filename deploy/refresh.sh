#!/bin/sh
# Put the production stack on the images deploy/build.sh just tagged.
#
#   sh deploy/refresh.sh
#
# Run by the `deploy` step of .woodpecker/pipeline.yml on a push to `main`. That
# step mounts the docker socket and the stack directory AT THE SAME PATH the
# host uses, so a path in the compose file (the uploads bind) means the same
# thing to this script as it does to the Docker daemon. Safe to run by hand on
# the host, from a checkout of `main`.
#
# What it does, in order:
#   1. refuses to run from any branch but `main` when CI says which branch;
#   2. refuses if a container with one of this stack's names belongs to some
#      other compose project (the dev database, see below);
#   3. creates the stack directory and its `.env` from docker/stack.env.example
#      on the first run, generates POSTGRES_PASSWORD if it is empty and no
#      database exists yet, and FILE_ACCESS_SECRET if it is empty;
#   4. copies the compose file and the operator scripts (deploy/stack/*.sh) in;
#   5. refuses to touch the stack while TUNNEL_TOKEN or POSTGRES_PASSWORD is
#      empty, and decides whether the Telegram bot runs: only when
#      TELEGRAM_BOT_TOKEN, TELEGRAM_API_ID, TELEGRAM_API_HASH and BOT_API_KEY
#      are all set (they are optional; the site deploys without them);
#   6. reports the `:previous` images (tagged by build.sh), which is
#      what deploy/stack/rollback.sh goes back to;
#   7. `docker compose -p filesdrop up -d --wait` for the site (not the `bot`
#      profile), then a smoke check of both public hostnames through the
#      tunnel; then, if enabled, the bot and its local Bot API server — a bot
#      that fails to start is reported but does not fail the deploy;
#   8. prunes superseded FilesDrop images (by label — nothing else's).
#
# The stack directory's `.env` and the uploads are NEVER synced in either
# direction and never leave this host. Only the compose file and the scripts
# are copied, and they are overwritten on every deploy.

set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STACK_DIR="${FILESDROP_STACK_DIR:-/home/archi/stacks/filesdrop}"
WAIT_TIMEOUT="${WAIT_TIMEOUT_SECONDS:-240}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-120}"
# uid:gid of `node` in both images, and of the person who owns ~/stacks.
OWNER="${FILESDROP_OWNER:-1000:1000}"
WEB_URL="https://filesdrop.luna-realm.com"
API_URL="https://filesdrop-api.luna-realm.com"

BRANCH="${CI_COMMIT_BRANCH:-}"
if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ]; then
  echo "refusing: production deploys from main, not from '$BRANCH'" >&2
  exit 1
fi

command -v docker >/dev/null || { echo "missing: docker" >&2; exit 1; }

value_of() {
  sed -n "s/^$2=//p" "$1" | head -1
}

set_value() {
  if grep -q "^$2=" "$1"; then
    sed -i "s|^$2=.*|$2=$3|" "$1"
  else
    printf '%s=%s\n' "$2" "$3" >> "$1"
  fi
}

# ─── 2. someone else's container under one of our names ─────────────────────
# The dev database is compose project `filesdrop-dev` (container
# `filesdrop-dev-postgres`), so it no longer shares a name with this stack. The
# guard stays for anything else that takes one of these names: `up` would fail
# on it — or, with --remove-orphans, which is why that flag is not used below,
# delete it. Stop rather than guess.
for c in filesdrop-postgres filesdrop-api filesdrop-web filesdrop-cloudflared \
  filesdrop-tg-api filesdrop-bot; do
  owner="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$c" 2>/dev/null || true)"
  if [ -n "$owner" ] && [ "$owner" != "$STACK_DIR" ]; then
    cat >&2 <<MSG
refusing: a container named $c already exists and belongs to the compose
project in $owner, not to $STACK_DIR.

That is almost certainly the development database (docker/docker-compose.yml,
started by \`bun run db:up\`). Stop it on this host with
  docker compose -f $owner/docker-compose.yml down
(its data volume is kept), then re-run this deploy.
MSG
    exit 1
  fi
done

echo "── $STACK_DIR ──"
mkdir -p "$STACK_DIR/uploads"

# ─── 3. the stack's .env ─────────────────────────────────────────────────────
ENV_FILE="$STACK_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "$REPO/docker/stack.env.example" "$ENV_FILE"
  echo "  created .env from docker/stack.env.example"
fi
chmod 600 "$ENV_FILE"

# Every key the example names must be present, even if empty, so that a later
# key added to the example shows up in the file the person edits.
for key in $(grep -oE '^[A-Z_][A-Z0-9_]*=' "$REPO/docker/stack.env.example" | tr -d '='); do
  grep -q "^$key=" "$ENV_FILE" || { printf '%s=\n' "$key" >> "$ENV_FILE"; echo "  added $key to .env"; }
done

# Generate the database password only while there is no database. Once the
# volume exists, postgres has already been initialised with whatever password
# it was first given; inventing a new one here would lock the api out of it.
if [ -z "$(value_of "$ENV_FILE" POSTGRES_PASSWORD)" ]; then
  if docker volume inspect filesdrop-postgres-data >/dev/null 2>&1; then
    echo "  POSTGRES_PASSWORD is empty but the database volume exists — not generating one" >&2
  else
    set_value "$ENV_FILE" POSTGRES_PASSWORD "$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
    echo "  generated POSTGRES_PASSWORD"
  fi
fi

# FILE_ACCESS_SECRET only signs short-lived unlock tokens, so generating one is
# always safe; replacing it later merely re-locks files unlocked minutes ago.
if [ -z "$(value_of "$ENV_FILE" FILE_ACCESS_SECRET)" ]; then
  set_value "$ENV_FILE" FILE_ACCESS_SECRET "$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
  echo "  generated FILE_ACCESS_SECRET"
fi

# ─── 4. compose file and operator scripts ────────────────────────────────────
cp "$REPO/docker/docker-compose.prod.yml" "$STACK_DIR/docker-compose.yml"
for s in "$REPO"/deploy/stack/*.sh; do
  cp "$s" "$STACK_DIR/${s##*/}"
  chmod +x "$STACK_DIR/${s##*/}"
done
echo "  compose file and scripts synced"

# This step runs as root; the directory belongs to the person, and uploads/ to
# `node` in the api image — the same uid on this host.
chown -R "$OWNER" "$STACK_DIR"

# ─── 5. refuse an incomplete .env ────────────────────────────────────────────
MISSING=""
for key in TUNNEL_TOKEN POSTGRES_PASSWORD; do
  [ -n "$(value_of "$ENV_FILE" "$key")" ] || MISSING="$MISSING $key"
done
if [ -n "$MISSING" ]; then
  cat >&2 <<MSG
refusing: $ENV_FILE has no value for:$MISSING

Nothing was started or recreated. Fill them in ON THE HOST (never in the
repository, never as a Woodpecker secret) and re-run the pipeline:
  TUNNEL_TOKEN       Cloudflare Zero Trust → Networks → Tunnels → filesdrop
  POSTGRES_PASSWORD  openssl rand -hex 32 (URL-safe; it goes into DATABASE_URL)
See deploy/README.md.
MSG
  exit 1
fi
echo "  .env complete"

# The Telegram bot is optional (compose profile `bot`): it runs only when all
# of its secrets are there. Missing ones are reported, never fatal.
BOT_MISSING=""
for key in TELEGRAM_BOT_TOKEN TELEGRAM_API_ID TELEGRAM_API_HASH BOT_API_KEY; do
  [ -n "$(value_of "$ENV_FILE" "$key")" ] || BOT_MISSING="$BOT_MISSING $key"
done
if [ -z "$BOT_MISSING" ]; then
  BOT_ENABLED=1
  echo "  telegram bot: enabled"
else
  BOT_ENABLED=0
  echo "  telegram bot: off (empty:$BOT_MISSING)"
fi

cd "$STACK_DIR"
export FILESDROP_STACK_DIR="$STACK_DIR"

# ─── 6. report what rollback.sh would go back to ─────────────────────────────
# `:previous` is set by deploy/build.sh BEFORE it rebuilds `:production`. It
# used to be set here from the running container's image ID, but with Docker's
# containerd image store an image whose tag has moved on can no longer be found
# by that ID ("No such image"), and the deploy died before `up`. Only report.
for app in api web bot; do
  prev="$(docker image inspect -f '{{.Id}}' "filesdrop-$app:previous" 2>/dev/null || true)"
  if [ -n "$prev" ]; then
    echo "  filesdrop-$app:previous = ${prev#sha256:}" | cut -c1-48
  else
    echo "  filesdrop-$app:previous — none yet (first deploy, nothing to roll back to)"
  fi
done

# ─── 7. recreate, wait for health, smoke ─────────────────────────────────────
echo "── up ──"
# The site first, WITHOUT the `bot` profile: whatever the bot does, it is not
# in this --wait and cannot fail it. A COMPOSE_PROFILES from the caller's
# environment would pull it back in, so it is cleared.
unset COMPOSE_PROFILES
# --wait: return only when every service is healthy (or running, for
# cloudflared, which has no healthcheck), and fail when one is not.
if ! docker compose -p filesdrop up -d --wait --wait-timeout "$WAIT_TIMEOUT"; then
  echo "the stack did not come up healthy — last logs:" >&2
  for c in filesdrop-postgres filesdrop-api filesdrop-web filesdrop-cloudflared; do
    echo "── $c ──" >&2
    docker logs --tail 40 "$c" 2>&1 | sed 's/^/    /' >&2 || true
  done
  echo "roll back with: sh $STACK_DIR/rollback.sh" >&2
  exit 1
fi

if [ "${SKIP_PUBLIC_SMOKE:-}" = "1" ]; then
  echo "── smoke skipped (SKIP_PUBLIC_SMOKE=1) ──"
else
  echo "── smoke, through the tunnel ──"
  # busybox wget exits non-zero on any 4xx/5xx, including Cloudflare's 530 for
  # a tunnel with no connector, and follows the locale redirect on `/`.
  for url in "$WEB_URL/" "$API_URL/health"; do
    deadline=$(($(date +%s) + SMOKE_TIMEOUT))
    until wget -q -T 10 -O /dev/null "$url"; do
      if [ "$(date +%s)" -ge "$deadline" ]; then
        echo "  $url: no 2xx after ${SMOKE_TIMEOUT}s" >&2
        docker logs --tail 40 filesdrop-cloudflared 2>&1 | sed 's/^/    /' >&2 || true
        echo "roll back with: sh $STACK_DIR/rollback.sh" >&2
        exit 1
      fi
      sleep 5
    done
    echo "  $url: ok"
  done
fi

# ─── 7b. the Telegram bot, after the site is live ────────────────────────────
# NOT fatal: by now the site is deployed and answering, and a bot that fails
# to start must not turn that into a failed deploy. It is reported loudly
# instead. The bot waits for the local Bot API server on its own and restarts
# on a crash (`restart: unless-stopped`). Its logs never contain the token; the
# sed below masks anything token-shaped from the server's logs all the same.
mask_tokens() {
  sed -E 's/[0-9]{5,}:[A-Za-z0-9_-]{30,}/<token>/g; s/^/    /'
}
if [ "$BOT_ENABLED" = "1" ]; then
  echo "── telegram bot ──"
  if docker compose -p filesdrop --profile bot up -d --no-deps --wait \
    --wait-timeout "$WAIT_TIMEOUT" filesdrop-tg-api filesdrop-bot; then
    echo "  filesdrop-tg-api, filesdrop-bot: up"
  else
    echo "WARNING: the site is deployed, but the Telegram bot did not come up:" >&2
    for c in filesdrop-tg-api filesdrop-bot; do
      echo "── $c ──" >&2
      docker logs --tail 30 "$c" 2>&1 | mask_tokens >&2 || true
    done
    echo "check TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_BOT_TOKEN in $ENV_FILE" >&2
  fi
else
  # Secrets removed since the last deploy: stop a bot that is still running.
  if docker inspect filesdrop-bot >/dev/null 2>&1 || docker inspect filesdrop-tg-api >/dev/null 2>&1; then
    docker compose -p filesdrop --profile bot rm -s -f filesdrop-bot filesdrop-tg-api >/dev/null 2>&1 || true
    echo "  telegram bot: stopped and removed (its secrets are incomplete)"
  fi
fi

# ─── 8. housekeeping ─────────────────────────────────────────────────────────
# Dangling images carrying our label only: each build orphans the previous
# `:production`, and `:previous` keeps the one rollback needs.
docker image prune -f --filter label=filesdrop.image >/dev/null || true

echo "── containers ──"
docker compose -p filesdrop --profile bot ps
