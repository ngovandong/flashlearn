# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Also read [`AGENTS.md`](./AGENTS.md)** — the universal, cross-tool guide that
> lists the project rules (theme adherence, mobile responsiveness, onboarding
> tour, knowledge graph) every agent must follow. The detailed rules live in
> `.cursor/rules/*.mdc`.

## Project Overview

FlashLearn is a language-learning platform (flashcards, guided courses, listening
dictation, grammar, AI speaking/writing coaches, and mixed cross-feature revision)
with these components:
- **Django backend** — primary API, auth, WebSocket game, async tasks, AI orchestration
- **Rust backend** — high-performance *partial* re-implementation of the Django API
  (opt-in, in-progress; only deck/term/user/learning/role/images/translate + the
  quick-revise WebSocket are ported)
- **React web frontend** — Material UI + Redux Toolkit SPA (`frontend/apps/web`)
- **Expo React Native app** — native client (`frontend/apps/mobile`)
- **Chrome extension** — select-text-to-save (`extension/`)

Both backends share the same MySQL database. The Rust backend does not run migrations — it reads/writes the schema that Django owns.

For the full architecture (bounded contexts, AI engine, diagrams) see
[`ARCHITECTURE.md`](./ARCHITECTURE.md); this file focuses on build/run commands.

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
uv run python manage.py test backend.tests
```

### Image crawler (`POST /api/images/`)

Providers run in batches of 2: **Google + Bing**, then **Openverse + Wikimedia** if more URLs are needed.

Google Images requires JavaScript. The crawler tries a fast HTTP pass first, then falls back to **Playwright** (headless Chromium) when Google returns a bot block page.

The Playwright fallback is an optional dependency group. Install it and the
browser once (`espeak-ng` is unrelated — that's for the Kokoro TTS group):

```bash
uv sync --group crawler
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

### Frontend (npm-workspace monorepo)
The `frontend/` folder is an npm-workspace umbrella:
`apps/web` (Vite website), `apps/mobile` (Expo app), and shared packages under
`packages/*` (`@flashlearn/core`, `@flashlearn/api`, `@flashlearn/auth`).

```bash
cd frontend
npm install                 # installs all workspaces (hoisted node_modules)

npm run dev:web             # web dev server on port 3000
npm run build:web           # production web build
npm test -w @flashlearn/web # web unit tests

npm run dev:mobile          # Expo dev server (apps/mobile)
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

Cron jobs live in the `backend/cron/` package (`ai.py`, `backup.py`, `email.py`,
`images.py`, `maintenance.py`, `speaking.py`) and are collected by
`backend/cron/__init__.py`. Their task implementations live in `backend/tasks/*.py`.
Add new scheduled tasks there and restart the worker to pick them up.

### Docker
```bash
# Production — starts db, redis, backend, worker, frontend
docker compose --env-file .env.docker up --build

# Production — worker only
docker compose --env-file .env.docker up worker

# Development overlay (hot-reload) — mounts local code into containers
docker compose --env-file .env.docker \
  -f docker-compose.yml -f docker-compose.dev.yml up --build

# Build the worker image explicitly (same Dockerfile as backend)
docker compose --env-file .env.docker build worker
```

The frontend image receives client-visible `VITE_*` values at build time.
Set them in `.env.docker`; runtime container variables cannot alter an already
built Vite bundle.

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
docker compose --env-file .env.docker \
  -f docker-compose.dockerhub.arm.selfservice.yml up -d
```
Requires `.env.docker`. The selfservice compose file targets ARM64 (`platform: linux/arm64`, tag `:arm64`).

## Architecture

### Request Flow
```
React (3000) → Django (8005) or Rust (8005)
                    ↓
              MySQL (3306 local / 3307 via Docker) + Redis (6379) + Elasticsearch (external/optional)
```

Nginx routes to the appropriate backend. Both backends expose the same port 8005 — they are not run simultaneously; the Rust backend is an opt-in replacement.

### Django App Structure
- `core/` — project settings (`settings.py`), ASGI/WSGI entry, URL root, `authentication.py`
- `backend/` — all domain logic (DDD bounded contexts, see below)
- `base/` — shared base model classes

**`backend/` internal layout:** the backend is organized into DDD / clean-architecture
bounded contexts (see `.cursor/rules/backend-architecture.mdc` for the enforced rules):
- `backend/<context>/` — one folder per bounded context (`deck`, `term`, `user`,
  `learning`, `role`, `speaking`, `course`, `listening`, `grammar`, `writing`,
  `revise`, `reminders`), each with `domain/` (pure rules, optional),
  `application/` (use-case services, injected deps; often `services.py`, sometimes
  `<feature>_service.py`), and `infrastructure/` (`repository.py` — the only place
  ORM access is allowed).
- `backend/shared/` — cross-cutting pieces: `application/ports.py` (Protocols),
  `infrastructure/` (AI providers, cache, cloudinary, oauth, sqlalchemy),
  `interfaces/` (base viewsets, pagination, exception handler), and
  `composition.py` (the composition root that wires concrete infra into services).
- `backend/views/` — thin DRF ViewSets per resource; call service singletons from
  `backend/services/__init__.py`.
- `backend/models/` — Django ORM models (schema owner).
- `backend/serializers/` — DRF serializers.
- `backend/consumers.py` — WebSocket consumer for `/ws/quick-revise/` multiplayer game.
- `backend/tasks/` + `backend/cron/` — domain-grouped RQ tasks and their schedules.

### Auth
JWT auth built on `rest_framework_simplejwt` behind `core/authentication.py`
(`CustomTokenAuthentication`). `POST /api/users/login` returns a short-lived access
token (kept in memory by clients) plus a rotating refresh token. The web SPA stores
the refresh token in an HttpOnly cookie; the mobile app stores it in the OS keychain
(Expo SecureStore) and sends it in the request body. `POST /api/users/refresh/`
rotates the session and `POST /api/users/logout/` revokes it. Google OAuth is at
`POST /api/users/google_login`. The `SECRET_KEY` env var is used for token signing
in both Django and Rust.

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
/api/             → backend.urls (DRF router: decks, terms, users, roles, learnings,
                    speaking, writing, courses, listening, grammar, reminders, revise, assistant)
/api/users/login  → SimpleJWT login (access + rotating refresh)
/api/users/refresh, /api/users/logout → rotate / revoke refresh session
/api/translate/   → translation service
/api/images/      → image crawler (Google/Bing/Openverse/Wikimedia via BSCrawler)
/api/swagger/     → Swagger UI (DEBUG=True only)
/ws/quick-revise/ → WebSocket multiplayer game
```
Note: the `folders` resource was removed (Django migration `0058_delete_folder`).

### WebSocket
Django Channels + Daphne handle WebSocket at `/ws/quick-revise/`. Redis is the channel layer backend.

## Environment Variables

Copy `.env.sample` to `.env` (see the file for the full list). Key variables:
- `SECRET_KEY` — used by both Django and Rust for token signing
- `DB_*` — MySQL connection (Django owns migrations)
- `REDIS_HOST/PORT` — shared cache and channel layer
- `ELASTIC_SEARCH_HOST/PORT` — Elasticsearch DSL host (search degrades if unset)
- `CLOUDINARY_*` — image and generated/listening audio storage
- `GOOGLE_OAUTH2_CLIENT_ID/SECRET` — Google login (web); plus
  `GOOGLE_OAUTH2_IOS_CLIENT_ID` / `GOOGLE_OAUTH2_ANDROID_CLIENT_ID` for mobile
- `REFRESH_COOKIE_NAME/SECURE/SAMESITE` — SPA refresh-token cookie behavior
- AI chain: `AI_PROVIDER`, `AI_FALLBACK_PROVIDERS` + provider keys (Gemini,
  OpenRouter, Azure OpenAI, LM Studio)
- Speech/TTS: `AZURE_SPEECH_*`, `ELEVENLABS_*` (Kokoro is local, no key)
- `ABSTRACT_API_KEY` — email validation; `DRIVE_*` — Google Drive DB backups
- `CRAWLER_GOOGLE_SKIP_PLAYWRIGHT` — disable the Playwright image-crawler fallback
- `BASE_FRONTEND_URL` / `BASE_BACKEND_URL` — CORS and redirect targets

## Tech Stack Versions
- Python 3.11, Django 5.2, DRF 3.17, Django Channels 4, SimpleJWT 5.5, SQLAlchemy 2
- Rust edition 2021, Axum 0.7, SQLx 0.8, Tokio 1
- React 19, Material UI v9, Redux Toolkit 2, React Router 7, Vite 8, Vitest 4
- Expo 57, React Native 0.86, Expo Router 57 (mobile)
- MySQL 8.0, Redis 6, Elasticsearch 8
