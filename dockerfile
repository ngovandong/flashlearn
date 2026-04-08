# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update \
    && apt-get install -y gcc curl \
    && apt-get install -y default-mysql-client default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the project files
COPY pyproject.toml uv.lock* /app/

# Set the MYSQLCLIENT_CFLAGS and MYSQLCLIENT_LDFLAGS environment variables
ENV MYSQLCLIENT_CFLAGS="-I/usr/include/mysql" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/x86_64-linux-gnu -lmysqlclient"

# Install project dependencies
RUN uv sync --frozen --no-cache

# Copy the Django project code
COPY . /app

# Expose the port that Django runs on
EXPOSE 8005

# Start the Django development server using Daphne (ASGI)
CMD ["uv", "run", "daphne", "-b", "0.0.0.0", "-p", "8005", "core.asgi:application"]
