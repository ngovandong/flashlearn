# syntax=docker/dockerfile:1

# Build context is the workspace root (./frontend), not apps/web, so the
# shared packages are available during install/build.

# Stage 1: Build the React application
FROM node:22-alpine AS build

WORKDIR /app

# Workspace manifests first (better layer caching). All workspace manifests are
# needed so `npm ci` can validate the shared lockfile; the mobile app's deps are
# installed only in this build stage and never reach the final nginx image.
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/

RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Source
COPY packages packages
COPY apps/web apps/web

ARG VITE_BASE_URL=http://localhost:8005/api/
ARG VITE_CRAWLER_URL=http://localhost:8005/api/
ARG VITE_SOCKET_URL=localhost:8005/ws
ARG VITE_AI_REQUEST_TIMEOUT=240000
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_CLOUD_NAME
ARG VITE_UPLOAD_PRESET

ENV VITE_BASE_URL=${VITE_BASE_URL} \
    VITE_CRAWLER_URL=${VITE_CRAWLER_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL} \
    VITE_AI_REQUEST_TIMEOUT=${VITE_AI_REQUEST_TIMEOUT} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} \
    VITE_CLOUD_NAME=${VITE_CLOUD_NAME} \
    VITE_UPLOAD_PRESET=${VITE_UPLOAD_PRESET}

RUN npm run build -w @flashlearn/web

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
