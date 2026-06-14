#!/bin/bash
set -e

# Allow overriding the container CLI (e.g. DOCKER=podman ./build.sh)
DOCKER="${DOCKER:-docker}"

PLATFORM=""
TAG="latest"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Use a separate tag for arm64
if [[ "$PLATFORM" == "linux/arm64" ]]; then
  TAG="arm64"
fi

PLATFORM_ARGS=""
if [[ -n "$PLATFORM" ]]; then
  PLATFORM_ARGS="--platform $PLATFORM"
fi

export DOCKER_BUILDKIT=1

# Build and push backend image (API / WebSocket)
$DOCKER build "$PLATFORM_ARGS" -t flashlearn_backend:$TAG --target backend -f Dockerfile .
$DOCKER tag flashlearn_backend:$TAG ngovandong/flashlearn_backend:$TAG
$DOCKER push ngovandong/flashlearn_backend:$TAG

# Build and push worker image (RQ + mysqldump for backups)
$DOCKER build "$PLATFORM_ARGS" -t flashlearn_worker:$TAG --target worker -f Dockerfile .
$DOCKER tag flashlearn_worker:$TAG ngovandong/flashlearn_worker:$TAG
$DOCKER push ngovandong/flashlearn_worker:$TAG

# Build and push frontend image
$DOCKER build "$PLATFORM_ARGS" -t flashlearn_frontend:$TAG -f frontend/Dockerfile frontend/
$DOCKER tag flashlearn_frontend:$TAG ngovandong/flashlearn_frontend:$TAG
$DOCKER push ngovandong/flashlearn_frontend:$TAG
