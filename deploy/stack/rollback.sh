#!/bin/sh
# Put api, web (and the Telegram bot, if it runs) back on the images that were
# running before the last deploy.
#
#   sh /home/archi/stacks/filesdrop/rollback.sh
#
# Copied into the stack directory by deploy/refresh.sh. `:previous` is set by
# deploy/build.sh: before it rebuilds `:production`, it tags the image the
# running containers use as `filesdrop-{api,web,bot}:previous` (by name, and
# only when that image really is what is running). This retags `:previous` as
# `:production` and recreates those containers. Postgres, the tunnel and the
# local Bot API server are left alone.
#
# The bot is optional: it is rolled back only when its container exists and a
# `filesdrop-bot:previous` image does too. A bot without `:previous` (its first
# release) is left as it is, and that does not stop api and web going back.
#
# LIMITS, so nobody reads more into this than it does:
#   * One step back only. The next deploy overwrites `:previous`.
#   * Migrations are NOT rolled back. Prisma has no down migrations; if the bad
#     release applied one, the old api has to run against the new schema. Check
#     apps/api/prisma/migrations in the bad commit before relying on this.
#   * The next push to `main` deploys `main` again. The lasting fix is a revert
#     merged through develop → main; this buys the time to make it.

set -eu

STACK_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$STACK_DIR"
export FILESDROP_STACK_DIR="$STACK_DIR"

for app in api web; do
  if ! docker image inspect "filesdrop-$app:previous" >/dev/null 2>&1; then
    echo "no filesdrop-$app:previous image — nothing to roll back to" >&2
    exit 1
  fi
done

for app in api web; do
  docker tag "filesdrop-$app:previous" "filesdrop-$app:production"
  echo "  filesdrop-$app:production ← :previous"
done

docker compose -p filesdrop up -d --wait --no-deps filesdrop-api filesdrop-web

if docker inspect filesdrop-bot >/dev/null 2>&1; then
  if docker image inspect filesdrop-bot:previous >/dev/null 2>&1; then
    docker tag filesdrop-bot:previous filesdrop-bot:production
    echo "  filesdrop-bot:production ← :previous"
    # Not --wait: a bot that misbehaves must not make the site's rollback fail.
    docker compose -p filesdrop --profile bot up -d --no-deps filesdrop-bot
  else
    echo "  filesdrop-bot: no :previous image — left as it is"
  fi
fi

docker compose -p filesdrop --profile bot ps
