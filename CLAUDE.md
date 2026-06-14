# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Also read [`AGENTS.md`](./AGENTS.md)** — the universal, cross-tool guide that
> lists the project rules (theme adherence, mobile responsiveness, onboarding
> tour, knowledge graph) every agent must follow. The detailed rules live in
> `.cursor/rules/*.mdc`.

## Project Overview

FlashLearn is a flashcard study application with three components:
- **Django backend** — primary API, auth, WebSocket game, async tasks
- **Rust backend** — high-performance partial re-implementation of the Django API (in-progress migration)
- **React frontend** — Material UI + Redux Toolkit SPA

Both backends share the same MySQL database. The Rust backend does not run migrations — it reads/writes the schema that Django owns.

## Commands

### Django Backend
```bash
# Run dev server
uv run python manage.py runserver 0.0.0.0:8005

# Install dependencies (uv)
uv sync --frozen --no-cache

# Migrations
uv run python manage.py migrate
uv run python manage.py makemigrations

# Tests
python manage.py test backend.tests
```

### Image crawler (`POST /api/images/`)

Providers run in batches of 2: **Google + Bing**, then **Openverse + Wikimedia** if more URLs are needed.

Google Images requires JavaScript. The crawler tries a fast HTTP pass first, then falls back to **Playwright** (headless Chromium) when Google returns a bot block page.

One-time Playwright browser install (after `uv sync`):

```bash
uv run playwright install chromium
```

On Armbian / low-memory hosts you can disable the Playwright fallback:

```bash
CRAWLER_GOOGLE_SKIP_PLAYWRIGHT=1
```

#### Testing image crawler strategies

Parser unit test (no network):

```bash
uv run python manage.py test backend.tests.test_crawler.GoogleImageParserTest -v 2
```

Live benchmark — all 4 providers, timings, and grouped URLs for manual verification:

```bash
CRAWLER_INTEGRATION=1 uv run python manage.py test backend.tests.test_crawler.CrawlerStrategyBenchmarkTest -v 2
```

Optional overrides:

```bash
CRAWLER_INTEGRATION=1 CRAWLER_BENCHMARK_QUERY="morning coffee" CRAWLER_BENCHMARK_COUNT=5 \
  uv run python manage.py test backend.tests.test_crawler.CrawlerStrategyBenchmarkTest -v 2
```

The benchmark prints each provider's URLs separately plus the combined `BSCrawler` merge. Google typically takes ~3–4s when Playwright is used.

### Rust Backend
```bash
cd rust_backend
cp .env.example .env   # first time only
cargo run              # dev
cargo build --release  # production build
cargo test
```

### Frontend
```bash
cd frontend
npm install
npm start    # dev server on port 3000
npm run build
npm test
```

### RQ Worker + Scheduler
The worker processes background jobs (e.g. sending emails) from the Redis queue.
The scheduler runs inside the same process and pushes cron jobs into the queue on schedule.
Redis must be running before starting the worker.

```bash
# Run worker + scheduler together (recommended)
uv run python manage.py start_worker

# Monitor queued/failed jobs
uv run python manage.py rqstats
```

Cron jobs are defined in `backend/cron.py` → `register_jobs()`.
Add new scheduled tasks there and restart the worker to pick them up.

### Docker
```bash
# Production — starts db, redis, backend, worker, frontend
docker-compose up

# Production — worker only
docker-compose up worker

# Development (hot-reload) — mounts local code into containers
docker-compose -f docker-compose.dev.yml up

# Build the worker image explicitly (same Dockerfile as backend)
docker-compose build worker
```

### Building & Pushing Images to Docker Hub
```bash
# Default build (linux/amd64, tagged :latest)
DOCKER=podman ./build.sh

# ARM64 build (tagged :arm64)
DOCKER=podman ./build.sh --platform linux/arm64
```

The `DOCKER` env var selects the CLI (`docker` by default). Use `DOCKER=podman` when aliasing docker to podman.
Images: `ngovandong/flashlearn_backend:<tag>` and `ngovandong/flashlearn_frontend:<tag>`.

### Running from Docker Hub (self-service, no local build)
```bash
# Uses pre-built images from Docker Hub
docker-compose -f docker-compose.dockerhub.selfservice.yml up -d
```
Requires `.env.docker`. The selfservice compose file targets ARM64 (`platform: linux/arm64`, tag `:arm64`).

## Architecture

### Request Flow
```
React (3000) → Django (8005) or Rust (8005)
                    ↓
              MySQL (3307) + Redis (6379) + Elasticsearch
```

Nginx routes to the appropriate backend. Both backends expose the same port 8005 — they are not run simultaneously; the Rust backend is an opt-in replacement.

### Django App Structure
- `core/` — project settings (`settings.py`), ASGI/WSGI entry, URL root
- `backend/` — all domain logic: models, views, serializers, services, consumers, tasks
- `base/` — shared base model classes

**`backend/` internal layout:**
- `models/` — User, Deck, Term, Folder, LearningProgress, UserDeckRole (OWNER/EDIT/VIEW)
- `views/` — DRF ViewSets per resource
- `services/` — business logic (UserService, DeckService, LearningService, AuthService, CacheService, MailService)
- `serializers/` — DRF serializers
- `consumers.py` — WebSocket consumer for `/ws/quick-revise/` multiplayer game
- `tasks.py` — RQ async tasks

### Auth
Custom token-based auth (not standard SimpleJWT flow). Login at `POST /api/users/login` returns a token stored per-user. Google OAuth at `POST /api/users/google_login`. The `SECRET_KEY` env var is used for token signing in both Django and Rust.

### Rust Backend Structure (`rust_backend/src/`)
DDD-style layering:
- `domain/` — enums, core rules (Role)
- `application/` — use-case services (deck, term, user, learning)
- `infrastructure/` — DB (SQLx/MySQL), Redis, Elasticsearch clients
- `interfaces/` — Axum HTTP routes and WebSocket handlers
- `auth/` — JWT validation, pbkdf2 password check
- `state.rs` — shared `AppState` (DB pool, Redis, config)

**Known gaps in Rust backend:** Google OAuth is stubbed, multipart bulk upload APIs not fully ported, Cloudinary simplified, Redis objects use JSON (incompatible with Django's pickled format).

### Key API Routes
```
/api/             → backend.urls (DRF router: decks, terms, users, folders, roles, learnings)
/api/users/login  → custom JWT login
/api/translate/   → translation service
/api/images/      → Cloudinary URL lookup
/api/swagger/     → Swagger UI (DEBUG=True only)
```

### WebSocket
Django Channels + Daphne handle WebSocket at `/ws/quick-revise/`. Redis is the channel layer backend.

## Environment Variables

Copy `.env.sample` to `.env`. Key variables:
- `SECRET_KEY` — used by both Django and Rust for token signing
- `DB_*` — MySQL connection (Django owns migrations)
- `REDIS_HOST/PORT` — shared cache and channel layer
- `CLOUDINARY_*` — image storage
- `GOOGLE_OAUTH2_CLIENT_ID/SECRET` — Google login
- `BASE_FRONTEND_URL` / `BASE_BACKEND_URL` — CORS and redirect targets

## Tech Stack Versions
- Python 3.11, Django 4.2, DRF 3.15, Django Channels 4.0
- Rust edition 2021, Axum 0.7, SQLx 0.8, Tokio 1
- React 18, Material UI v7, Redux Toolkit 2, React Router 7
- MySQL 8.0, Redis 6
