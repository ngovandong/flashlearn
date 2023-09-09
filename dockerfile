# Use an official Python runtime as a parent image
FROM python:3.8-slim-buster
# Install system dependencies
RUN apt-get update
RUN apt-get install -y gcc
RUN apt-get install -y default-mysql-client default-libmysqlclient-dev
RUN pip install poetry
# Set the working directory to /app
WORKDIR /app

# Install any needed packages specified in requirements.txt
COPY pyproject.toml poetry.lock /app/
RUN poetry config virtualenvs.create false && \
    poetry install --no-dev --no-root --no-interaction

# Copy the Django project code
COPY . /app

# Expose the port that Django runs on
EXPOSE 8000

# Start the Django development server using Gunicorn
CMD poetry run gunicorn core.wsgi:application --bind 0.0.0.0:8000 -w 2
