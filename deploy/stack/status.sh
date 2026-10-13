#!/bin/sh
# What the production stack is running, and whether it is healthy.
#
#   sh /home/archi/stacks/filesdrop/status.sh
#
# Copied into the stack directory by deploy/refresh.sh. Read-only: it never
# prints the .env, only which of its keys are filled.

set -eu

STACK_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$STACK_DIR"
export FILESDROP_STACK_DIR="$STACK_DIR"

echo "── containers ──"
docker compose -p filesdrop ps

echo "── images ──"
for app in api web; do
  for tag in production previous; do
    created="$(docker image inspect -f '{{.Created}}' "filesdrop-$app:$tag" 2>/dev/null || echo '(none)')"
    echo "  filesdrop-$app:$tag  $created"
  done
done

echo "── .env ──"
for key in TUNNEL_TOKEN POSTGRES_PASSWORD; do
  if [ -n "$(sed -n "s/^$key=//p" .env 2>/dev/null | head -1)" ]; then
    echo "  $key: set"
  else
    echo "  $key: EMPTY"
  fi
done

echo "── uploads ──"
du -sh uploads 2>/dev/null || echo "  (no uploads directory)"
