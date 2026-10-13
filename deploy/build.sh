#!/bin/sh
# Build the two production images on this host, from the checkout this script
# lives in.
#
#   sh deploy/build.sh
#
# Run by the `build-images` step of .woodpecker/pipeline.yml on a push to
# `main`, with the docker socket mounted; also safe to run by hand. It only
# builds and tags — nothing running is touched until deploy/refresh.sh.
#
# BOTH images, every time, with no "what changed" filter: a stack half on the
# new build and half on the old one is a stack nobody can trust a result from.
#
# The public origins are fixed here, not read from the stack's `.env`: they are
# not secrets, they are baked into the client bundle at build time, and the
# Cloudflare tunnel routes (issue #1, Decision 2) are what they must match.

set -eu

WEB_URL="https://filesdrop.luna-realm.com"
API_URL="https://filesdrop-api.luna-realm.com"

cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "missing: docker" >&2; exit 1; }

# Keep what is deployed as `:previous` for deploy/stack/rollback.sh, by NAME,
# before `:production` moves (the containerd image store cannot find a
# superseded image by ID afterwards). Only when the running container really
# runs the current `:production`, so re-running a pipeline whose deploy failed
# does not overwrite the real previous release with a never-deployed build.
for app in api web; do
  current="$(docker image inspect -f '{{.Id}}' "filesdrop-$app:production" 2>/dev/null || true)"
  running="$(docker inspect -f '{{.Image}}' "filesdrop-$app" 2>/dev/null || true)"
  if [ -n "$current" ] && [ "$current" = "$running" ]; then
    docker tag "filesdrop-$app:production" "filesdrop-$app:previous"
    echo "  filesdrop-$app:previous ← running :production"
  fi
done

echo "── filesdrop-api ──"
docker build -t filesdrop-api:production -f apps/api/Dockerfile .

echo "── filesdrop-web ──"
docker build \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
  --build-arg NEXT_PUBLIC_WEB_URL="$WEB_URL" \
  -t filesdrop-web:production -f apps/web/Dockerfile .

echo "── built ──"
docker image ls --format '  {{.Repository}}:{{.Tag}}  {{.Size}}  {{.CreatedSince}}' \
  | grep -E '^  filesdrop-(api|web):production' || true
echo "  web bundle points at: $API_URL · links on $WEB_URL"
