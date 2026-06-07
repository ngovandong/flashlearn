# Stage 1: Build — install deps with build tools
FROM python:3.11-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gcc curl default-libmysqlclient-dev dpkg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the project files
COPY pyproject.toml uv.lock* ./

# Detect arch dynamically so this works on both amd64 and arm64
RUN ARCH=$(dpkg-architecture -qDEB_HOST_MULTIARCH) && \
    MYSQLCLIENT_CFLAGS="-I/usr/include/mysql" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/${ARCH} -lmysqlclient" \
    uv sync --frozen --no-cache

# Stage 2: Runtime — only what's needed to run
FROM python:3.11-slim

# Runtime MySQL library (Python mysqlclient) + mariadb-client (mysqldump for backups)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmariadb3 mariadb-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy built virtualenv from builder
COPY --from=builder /app/.venv /app/.venv

# Copy the Django project code
COPY . /app

# Expose the port that Django runs on
EXPOSE 8005

# Start the Django development server using Daphne (ASGI)
CMD ["uv", "run", "daphne", "-b", "0.0.0.0", "-p", "8005", "core.asgi:application"]
