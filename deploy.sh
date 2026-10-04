#!/bin/bash
# Run on the Ubuntu server: pull the latest images from Docker Hub and (re)start the stack,
# replacing any existing flashlearn containers.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.docker.prod"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE"; exit 1; }

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# Remove containers with fixed names that may have been created outside this compose project
for c in flashlearn_redis flashlearn_backend flashlearn_worker flashlearn_frontend; do
  docker rm -f "$c" >/dev/null 2>&1 || true
done

"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d --force-recreate --remove-orphans
docker image prune -f >/dev/null

"${COMPOSE[@]}" ps
