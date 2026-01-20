#!/bin/bash

# Default to production if IS_DEBUG is not set
IS_DEBUG=${IS_DEBUG:-false}

if [ "$IS_DEBUG" = "true" ]; then
    echo "Starting in DEBUG mode (Hot Reload)..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
else
    echo "Starting in PRODUCTION mode (Minimal)..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
fi
