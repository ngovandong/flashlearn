# Flashlearn Rust API

High-performance **partial** re-implementation of the Django REST + Channels API, using **Axum**, **sqlx** (MySQL), **Redis**, and optional **Elasticsearch**.

**Ported route groups:** `users`, `decks`, `terms`, `roles`, `learnings`,
`images`, `translate`, and the `/ws/quick-revise/` WebSocket. The AI/learning
feature contexts that exist in Django (`speaking`, `writing`, `courses`,
`listening`, `grammar`, `reminders`, `revise`) are **not** ported — route those
to the Django backend. See "Limitations / follow-ups" below.

## Layout (DDD-style)

| Layer | Path | Role |
|-------|------|------|
| Domain | `src/domain/` | Role enums, pure rules |
| Application | `src/application/` | Use cases (learning progress, deck clone, …) |
| Infrastructure | `src/infrastructure/` | DB, Redis, Elasticsearch, Django-compatible passwords |
| Interfaces | `src/interfaces/http/`, `src/interfaces/ws/` | HTTP and WebSocket adapters |
| Config | `src/config/` | All settings from environment (no hard-coded deployment values) |

## Prerequisites

- Rust **1.75+** (edition 2021)
- **MySQL** with the existing Django schema (this service does not run migrations)
- **Redis** (optional if `SKIP_REDIS=1`, with reduced parity vs Django caching)
- **Elasticsearch** (optional; deck/term `search` falls back to SQL on failure)

## Configuration

Copy `.env.example` to `.env` in this directory (or the repo root) and adjust values. `dotenvy` loads `.env` automatically on startup.

Critical: `SECRET_KEY` must match the Django project if you need existing JWT access tokens to validate.

MySQL UUID columns follow Django’s `CHAR(32)` hex encoding (see `src/util/db_uuid.rs`). If your database uses hyphenated UUID strings instead, set a migration or adjust the helper.

## Run (development)

```bash
cd rust_backend
cp .env.example .env
# edit .env — at minimum DATABASE_URL or DB_* and SECRET_KEY
cargo run
```

The server listens on `BIND_HOST`:`PORT` (default `0.0.0.0:8005`).

Health check: `GET /healthz` → `200` body `ok`.

## Debug

- **Logging**: set `RUST_LOG`, e.g. `RUST_LOG=debug,sqlx=warn,tower_http=debug cargo run`
- **lldb** (macOS): `lldb target/debug/flashlearn-server` then `run`
- **VS Code**: add a launch configuration that runs `cargo run` with `cwd` = `rust_backend` and env from `.env`

## Docker

From `rust_backend/`:

```bash
docker build -t flashlearn-rust .
docker run --env-file .env -p 8005:8005 flashlearn-rust
```

Use the same MySQL/Redis as the Python stack (see repo `docker-compose.yml`); point `DATABASE_URL` / `REDIS_*` at those services. Elasticsearch is **not** part of the compose file — run it externally (or leave it unset) and point `ELASTIC_SEARCH_*` at it; search falls back to SQL when it is unavailable.

## Redis note (Django → Rust)

Django may store pickled objects in Redis for `user_{id}` keys. This server writes **JSON** for that key when authenticating. After switching fully to Rust, flush relevant keys or use a separate Redis DB index.

## Limitations / follow-ups

- **Feature contexts not ported:** `speaking`, `writing`, `courses`, `listening`,
  `grammar`, `reminders`, and `revise` have no Rust routes — keep those on Django.
- **Folders API is stale:** the Rust backend still exposes `/api/folders/*` against
  `backend_folder`, but Django **deleted** the `Folder` model (migration
  `0058_delete_folder`). Those routes (and the `migrate_tests` folder cases) should
  be removed or treated as dead.
- **Multipart bulk term APIs** (`add_terms`, `update_terms`) are not fully ported; extend with `multipart` parsing if you rely on form-style uploads.
- **Google login / `init`**: OAuth exchange is stubbed; complete `user_get_or_create` like `UserService` in Python.
- **Cloudinary**: term `create` accepts a URL string; full multipart upload to Cloudinary can be added in `terms` routes.
- **WebSocket**: timer-based `game_over` for timeouts is simplified; extend with `tokio::time` if the client depends on it.

## License

Same as the parent project.
