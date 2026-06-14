# syntax=docker/dockerfile:1

# Stage 1: Build — install deps with build tools
FROM python:3.11-slim AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc default-libmysqlclient-dev dpkg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.9.24 /uv /uvx /bin/

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    ARCH=$(dpkg-architecture -qDEB_HOST_MULTIARCH) && \
    MYSQLCLIENT_CFLAGS="-I/usr/include/mysql" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/${ARCH} -lmysqlclient" \
    uv sync --frozen --no-dev --no-cache

# Stage 2: Runtime base — shared by backend and worker targets
FROM python:3.11-slim AS runtime-base

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends libmariadb3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH" \
    VIRTUAL_ENV="/app/.venv" \
    PYTHONUNBUFFERED=1

COPY --from=builder /app/.venv /app/.venv
COPY manage.py ./
COPY core/ core/
COPY backend/ backend/
COPY base/ base/

EXPOSE 8005

# Stage 3a: API / WebSocket server
FROM runtime-base AS backend

CMD ["daphne", "-b", "0.0.0.0", "-p", "8005", "core.asgi:application"]

# Stage 3b: RQ worker (includes mysqldump for scheduled backups)
FROM runtime-base AS worker

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends mariadb-client \
    && rm -rf /var/lib/apt/lists/*

CMD ["python", "manage.py", "start_worker"]
