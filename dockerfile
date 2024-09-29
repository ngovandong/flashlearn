# Use an official Python runtime as a parent image
FROM python:3.8-slim-buster

# Install system dependencies
RUN apt-get update \
    && apt-get install -y gcc \
    && apt-get install -y default-mysql-client default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Copy the poetry.lock and pyproject.toml files
COPY poetry.lock pyproject.toml /app/

# Install poetry
RUN pip install poetry

# Set the MYSQLCLIENT_CFLAGS and MYSQLCLIENT_LDFLAGS environment variables
ENV MYSQLCLIENT_CFLAGS="-I/usr/include/mysql" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/x86_64-linux-gnu -lmysqlclient"

# Install project dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy the Django project code
COPY . /app

# Expose the port that Django runs on
EXPOSE 8005

# Start the Django development server using Gunicorn
CMD ["poetry", "run", "gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8005", "-w", "2"]
