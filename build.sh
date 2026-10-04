#!/bin/bash
# Build and push FlashLearn images to Docker Hub (multi-arch by default).
#
# Usage: ./build.sh [--service backend|worker|frontend|all] [--platform LIST] [--tag TAG] [--env-file FILE]
#   --service    which image(s) to build            (default: all)
#   --platform   comma-separated buildx platforms   (default: linux/amd64,linux/arm64)
#   --tag        image tag                          (default: latest)
#   --env-file   file providing VITE_* build values (default: .env.docker.prod)
set -euo pipefail
cd "$(dirname "$0")"

REPO="ngovandong"
SERVICE="all"
PLATFORM="linux/amd64,linux/arm64"
TAG="latest"
ENV_FILE=".env.docker.prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)  SERVICE="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --tag)      TAG="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help)  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

case "$SERVICE" in backend|worker|frontend|all) ;; *) echo "Invalid --service: $SERVICE"; exit 1 ;; esac

# Multi-platform builds need a docker-container buildx builder
if ! docker buildx inspect flashlearn-builder >/dev/null 2>&1; then
  docker buildx create --name flashlearn-builder --driver docker-container >/dev/null
fi
BUILDX=(docker buildx build --builder flashlearn-builder --platform "$PLATFORM" --push)

build_python() {  # $1 = backend|worker
  echo ">> $1 ($PLATFORM) -> $REPO/flashlearn_$1:$TAG"
  "${BUILDX[@]}" --target "$1" -f Dockerfile -t "$REPO/flashlearn_$1:$TAG" .
}

build_frontend() {
  [[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (needed for VITE_* values)"; exit 1; }
  set -a; source "$ENV_FILE"; set +a
  local args=()
  for name in VITE_BASE_URL VITE_CRAWLER_URL VITE_SOCKET_URL VITE_AI_REQUEST_TIMEOUT \
              VITE_GOOGLE_CLIENT_ID VITE_CLOUD_NAME VITE_UPLOAD_PRESET; do
    [[ -n "${!name:-}" ]] && args+=(--build-arg "$name=${!name}")
  done
  echo ">> frontend ($PLATFORM) -> $REPO/flashlearn_frontend:$TAG"
  "${BUILDX[@]}" ${args[@]+"${args[@]}"} -f frontend/apps/web/Dockerfile -t "$REPO/flashlearn_frontend:$TAG" frontend/
}

[[ "$SERVICE" == all || "$SERVICE" == backend  ]] && build_python backend
[[ "$SERVICE" == all || "$SERVICE" == worker   ]] && build_python worker
[[ "$SERVICE" == all || "$SERVICE" == frontend ]] && build_frontend
echo "Done."
