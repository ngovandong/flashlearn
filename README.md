# FlashLearn

FlashLearn is a web application built with Django (Backend) and React (Frontend).

## Tech Stack

- **Backend**: Django, Django Rest Framework (DRF), MySQL, Redis, Elasticsearch
- **Frontend**: React, Material UI, Redux Toolkit
- **Infrastructure**: Docker (implied by Dockerfile)

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL
- Redis

### Backend Setup

1.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt # If available, otherwise check pyproject.toml
    # or
    pip install .
    ```
3.  Set up environment variables (copy `.env.sample` to `.env`).
4.  Run migrations:
    ```bash
    python manage.py migrate
    ```
5.  Start the server:
    ```bash
    python manage.py runserver
    ```

### Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm start
    ```

## Background Worker & Cron Jobs

FlashLearn uses [RQ](https://python-rq.org/) for background job processing and [rq-scheduler](https://github.com/rq/rq-scheduler) for recurring cron tasks. Both run inside a single worker process — no extra container needed.

### How it works

```
Worker process
├── main thread   → RQ Worker    (executes jobs from the Redis queue)
└── daemon thread → RQ Scheduler (pushes cron jobs into the queue on schedule)
```

When the worker starts it:
1. Clears any previously registered scheduled jobs from Redis (prevents duplicates on restart)
2. Re-registers all jobs defined in `backend/cron.py`
3. Starts the scheduler in a background thread
4. Starts the worker on the main thread

### Starting the worker locally

Redis must be running first.

```bash
uv run python manage.py start_worker
```

### Adding a new cron job

**Step 1** — Write the task function in `backend/tasks.py`:

```python
def my_new_task():
    # do work here
    logger.info("my_new_task ran")
```

**Step 2** — Register the schedule in `backend/cron.py`:

```python
def register_jobs(scheduler: Scheduler) -> None:
    from .tasks import ..., my_new_task

    scheduler.cron(
        '0 9 * * 1',      # cron expression — every Monday at 09:00 UTC
        func=my_new_task,
        id='my_new_task',  # unique ID — used to cancel/replace on restart
        use_local_timezone=False,
    )
```

**Step 3** — Restart the worker. It picks up the new schedule automatically.

### Cron expression reference

| Expression     | Meaning                        |
|----------------|--------------------------------|
| `0 1 * * *`    | Every day at 01:00 UTC         |
| `0 * * * *`    | Every hour on the hour         |
| `0 9 * * 1`    | Every Monday at 09:00 UTC      |
| `*/15 * * * *` | Every 15 minutes               |
| `0 0 1 * *`    | First day of every month 00:00 |

Use [crontab.guru](https://crontab.guru) to build and validate expressions.

### Built-in cron jobs

| Job ID                   | Schedule         | Description                                      |
|--------------------------|------------------|--------------------------------------------------|
| `daily_reminders`        | `0 1 * * *`      | Email users who haven't studied today (08:00 VNT)|
| `cleanup_learning_cache` | `0 * * * *`      | Evict stale learning-progress cache entries      |

### Monitoring the queue

```bash
# Live queue stats
uv run python manage.py rqstats

# Inspect failed jobs via Django admin
# → /admin/django_rq/  (requires DEBUG=True or admin access)
```

---

## Building & Publishing Docker Images

Use `build.sh` to build and push images to Docker Hub.

### Prerequisites
- [Podman](https://podman.io/) or Docker installed
- Logged in to Docker Hub (`podman login docker.io` or `docker login`)

### Usage

```bash
# Default build (linux/amd64, tagged :latest)
DOCKER=podman ./build.sh

# ARM64 build (tagged :arm64)
DOCKER=podman ./build.sh --platform linux/arm64
```

The `DOCKER` environment variable selects the container CLI (`docker` by default, override with `podman`).

| Platform flag | Image tag |
|---|---|
| *(none)* | `latest` |
| `--platform linux/arm64` | `arm64` |

Images pushed:
- `ngovandong/flashlearn_backend:<tag>`
- `ngovandong/flashlearn_frontend:<tag>`

### Running from Docker Hub (self-service)

Copy `.env.sample` to `.env.docker`, fill in the values, then:

```bash
# ARM64 host
docker-compose -f docker-compose.dockerhub.selfservice.yml up -d

# AMD64 host — edit the file to use :latest tag and remove platform: linux/arm64
docker-compose -f docker-compose.dockerhub.selfservice.yml up -d
```

---

## Code Quality

Pre-commit hooks run automatically on every `git commit`. They cover:

| Hook | Scope | What it does |
|---|---|---|
| `ruff check --fix` | Python | Linting — replaces flake8, isort, pyupgrade |
| `ruff format` | Python | Formatting — replaces autopep8/black |
| `bandit` | Python | Security scan (hardcoded secrets, unsafe calls) |
| `eslint --fix` | JS/JSX | React linting with auto-fix |
| `hadolint` | Dockerfile | Dockerfile best-practice checks |
| `shellcheck` | Shell | Shell script linting (`build.sh`, `run_docker.sh`) |
| `check-json/yaml/toml` | Config files | Syntax validation |
| `detect-private-key` | All | Blocks PEM private keys from being committed |

### First-time setup

```bash
# Install dev dependencies (includes pre-commit and ruff)
uv sync

# Install the git hook
uv run pre-commit install
```

### Running manually

```bash
# Run all hooks against staged files (same as a commit)
uv run pre-commit run

# Run all hooks against every file in the repo
uv run pre-commit run --all-files

# Run a specific hook only
uv run pre-commit run ruff --all-files
uv run pre-commit run eslint --all-files
uv run pre-commit run bandit --all-files
```

### Updating hook versions

```bash
uv run pre-commit autoupdate
```

### Skipping hooks (emergency only)

```bash
git commit --no-verify -m "your message"
```

---

## Testing

Run backend tests:

```bash
python manage.py test backend.tests
```
