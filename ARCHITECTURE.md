<div align="center">

# 🐉 FlashLearn — Architecture & System Guide

#### *Learn faster. Speak better. Remember forever.*

A flashcard study platform with **AI term enrichment**, an **AI Speaking Coach**,
real-time **multiplayer revision**, a **Chrome extension**, and a dual
**Django + Rust** backend sharing one database.

<br/>

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/DRF-3.15-A30000?logo=django&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white)
![Axum](https://img.shields.io/badge/Axum-0.7-000000?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MUI](https://img.shields.io/badge/MUI-7-007FFF?logo=mui&logoColor=white)
![Redux](https://img.shields.io/badge/Redux_Toolkit-2-764ABC?logo=redux&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-6-DC382D?logo=redis&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8-005571?logo=elasticsearch&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-multimodal-8E75B2?logo=googlegemini&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)

</div>

> [!TIP]
> **All diagrams below are [Mermaid](https://mermaid.js.org/) and render live on GitHub / VS Code / Cursor.**
> They are the closest thing to an animated walkthrough — follow the arrows top‑to‑bottom to "play" each flow.

---

## 📑 Table of Contents

| # | Section | What you'll learn |
|---|---------|-------------------|
| 1 | [The 30‑second tour](#-the-30-second-tour) | What FlashLearn is, at a glance |
| 2 | [Tech stack](#-tech-stack) | Every technology and why it's here |
| 3 | [System architecture](#-system-architecture-birds-eye-view) | How the pieces fit together |
| 4 | [Repository map](#-repository-map) | Where everything lives |
| 5 | [The DDD backend](#-the-ddd-backend-bounded-contexts) | Bounded contexts & layering |
| 6 | [Data model](#-data-model-er-diagram) | The database, visually |
| 7 | [Request lifecycle](#-request-lifecycle) | A request from click to DB |
| 8 | [🤖 The AI engine](#-the-ai-engine) | Providers, failover, rate‑gate |
| 9 | [✨ AI term enrichment](#-ai-flow-1--term-enrichment) | Bare word → dictionary entry |
| 10 | [🗣️ AI Speaking Coach](#️-ai-flow-2--the-speaking-coach) | Dialogue + pronunciation scoring |
| 11 | [🎮 Realtime multiplayer](#-realtime-the-quick-revise-game) | The WebSocket game |
| 12 | [🧠 Learning & memory](#-learning--spaced-revision) | The revision scoring model |
| 13 | [Frontend architecture](#-frontend-architecture) | React app structure |
| 14 | [Background jobs](#-background-jobs--cron) | Worker, scheduler, emails |
| 15 | [Chrome extension](#-chrome-extension) | Select‑to‑save anywhere |
| 16 | [Deployment](#-deployment) | Docker & images |

---

## 🚀 The 30‑second tour

```mermaid
mindmap
  root((🐉 FlashLearn))
    Study
      Flashcards and Decks
      Learn Revise Quiz
      Number Test
      Guided courses and Live Role-play
    AI
      Term enrichment
      Speaking Coach
      Pronunciation scoring
      Image crawler
      Translation
    Social
      Public deck cloning
      Roles owner edit view
      Realtime Quick-Revise game
    Reach
      React web app
      Chrome extension
      Email reminders
    Engine
      Django + DRF
      Rust + Axum
      MySQL · Redis · Elasticsearch
```

FlashLearn turns a plain word into a rich, Oxford‑style flashcard using AI, lets
you study it in multiple game modes, practice **speaking** it with an AI coach
that scores your pronunciation, and **race friends** to revise — all themeable,
mobile‑first, and installable as a browser extension.

---

## 🧰 Tech stack

<table>
<tr><th>Layer</th><th>Technology</th><th>Role in FlashLearn</th></tr>

<tr><td rowspan="6"><b>🐍 Django backend</b><br/><sub>primary API</sub></td>
<td>Python 3.11 · Django 4.2</td><td>Core web framework, ORM, migrations (owns the schema)</td></tr>
<tr><td>Django REST Framework 3.15</td><td>ViewSets, serializers, the REST API surface</td></tr>
<tr><td>Django Channels 4 + Daphne</td><td>ASGI server & WebSockets for the multiplayer game</td></tr>
<tr><td>SQLAlchemy 2 (read side)</td><td>Hand‑tuned read queries alongside the Django ORM</td></tr>
<tr><td>django‑rq + rq‑scheduler</td><td>Background jobs & cron (emails, cache cleanup, backups)</td></tr>
<tr><td>drf‑yasg</td><td>Swagger / ReDoc API docs (DEBUG only)</td></tr>

<tr><td rowspan="4"><b>🦀 Rust backend</b><br/><sub>opt‑in replacement</sub></td>
<td>Rust 2021 · Axum 0.7</td><td>High‑performance partial re‑implementation of the API</td></tr>
<tr><td>SQLx 0.8 · Tokio 1</td><td>Async MySQL access over the same schema</td></tr>
<tr><td>JWT · pbkdf2</td><td>Token validation & Django‑compatible password checks</td></tr>
<tr><td>DDD layering</td><td>domain / application / infrastructure / interfaces</td></tr>

<tr><td rowspan="6"><b>⚛️ React frontend</b></td>
<td>React 18</td><td>SPA UI</td></tr>
<tr><td>Material UI 7 + Emotion</td><td>Component library & styling</td></tr>
<tr><td>Redux Toolkit 2 + React‑Redux</td><td>Global state</td></tr>
<tr><td>TanStack Query 5</td><td>Server‑state caching & fetching</td></tr>
<tr><td>React Router 7</td><td>Routing</td></tr>
<tr><td>Sass + CSS custom properties</td><td>Runtime theming (light/dark + palettes)</td></tr>

<tr><td rowspan="4"><b>🗄️ Data & infra</b></td>
<td>MySQL 8</td><td>System of record (shared by both backends)</td></tr>
<tr><td>Redis 6</td><td>Cache, RQ queue, Channels layer, AI rate‑gate</td></tr>
<tr><td>Elasticsearch 8</td><td>Full‑text deck & term search</td></tr>
<tr><td>Cloudinary</td><td>Image storage / optimization</td></tr>

<tr><td rowspan="4"><b>🤖 AI & external</b></td>
<td>Google Gemini</td><td>Multimodal: term enrichment, dialogue, TTS, pronunciation</td></tr>
<tr><td>OpenRouter</td><td>Text/JSON fallback provider</td></tr>
<tr><td>Google OAuth</td><td>Social login</td></tr>
<tr><td>Playwright (Chromium)</td><td>Headless fallback for the Google image crawler</td></tr>

<tr><td><b>🧩 Extension</b></td>
<td>React + Chrome MV3</td><td>Select‑text‑to‑save on any web page</td></tr>

<tr><td><b>🚢 Delivery</b></td>
<td>Docker Compose · Podman · Nginx</td><td>Local, dev hot‑reload, and self‑service deployment</td></tr>
</table>

---

## 🗺️ System architecture (bird's‑eye view)

```mermaid
flowchart TB
    subgraph clients["👥 Clients"]
        Web["⚛️ React SPA<br/>(port 3000)"]
        Ext["🧩 Chrome Extension"]
    end

    Nginx{{"🔀 Nginx<br/>reverse proxy"}}

    subgraph backends["⚙️ Backends — one port (8005), not run together"]
        Django["🐍 Django + DRF<br/>+ Channels/Daphne"]
        Rust["🦀 Rust + Axum<br/>(opt-in)"]
    end

    Worker["⏰ RQ Worker + Scheduler<br/>(jobs & cron)"]

    subgraph data["🗄️ Shared data layer"]
        MySQL[("MySQL 8<br/>system of record")]
        Redis[("Redis<br/>cache · queue · channels · AI gate")]
        ES[("Elasticsearch<br/>search")]
    end

    subgraph ext["🌐 External services"]
        Gemini["🤖 Gemini"]
        OpenRouter["🤖 OpenRouter"]
        Cloud["🖼️ Cloudinary"]
        OAuth["🔐 Google OAuth"]
    end

    Web --> Nginx
    Ext --> Nginx
    Nginx --> Django
    Nginx -. swap .-> Rust

    Django <--> MySQL
    Django <--> Redis
    Django <--> ES
    Rust <--> MySQL
    Rust <--> Redis
    Rust <--> ES

    Django --> Gemini & OpenRouter & Cloud & OAuth
    Worker <--> Redis
    Worker <--> MySQL
    Worker --> Gemini

    classDef store fill:#0b3d4d,stroke:#06b6d4,color:#fff
    classDef svc fill:#3b2a5a,stroke:#a78bfa,color:#fff
    class MySQL,Redis,ES store
    class Gemini,OpenRouter,Cloud,OAuth svc
```

> [!NOTE]
> **Both backends speak the same database and the same port 8005.** They are
> *never* run simultaneously — the Rust backend is an opt‑in, in‑progress
> performance re‑implementation. **Django owns all migrations**; Rust only
> reads/writes the schema Django defines.

---

## 📁 Repository map

```text
flashlearn/
├── core/                      ⚙️  Django project: settings, ASGI/WSGI, URL root, auth
├── backend/                   🧠  All domain logic (see "DDD backend" below)
│   ├── deck/  term/  user/    📦  Bounded contexts (DDD: domain/application/infrastructure)
│   ├── learning/  role/  folder/  speaking/
│   ├── course/  reminders/    📚  Guided courses & home "pick up where you left off"
│   ├── shared/                🔌  Cross-context: composition root, AI, cache, ports
│   │   ├── composition.py     🧩  Wires concrete infra into services (DI root)
│   │   └── infrastructure/ai/ 🤖  Gemini · OpenRouter · ElevenLabs · Azure Speech/TTS, failover, rate-gate
│   ├── models/                🗃️  Django ORM models (schema owner)
│   ├── views/                 🚪  DRF ViewSets per resource
│   ├── serializers/           🔄  DRF serializers
│   ├── consumers.py           🎮  WebSocket consumer for the Quick-Revise game
│   ├── tasks.py + cron/       ⏰  RQ tasks & schedules
│   └── documents/             🔎  Elasticsearch document mappings
├── base/                      🧱  Shared abstract models (UUID, timestamps, User base)
├── rust_backend/src/          🦀  domain / application / infrastructure / interfaces
├── frontend/src/              ⚛️  React SPA (see "Frontend architecture")
├── extension/                 🧩  Chrome extension (React + MV3)
├── media/  dump/              📂  Local media & DB dumps
├── docker-compose*.yml        🚢  Prod, dev hot-reload, self-service variants
└── graphify-out/              🕸️  Generated knowledge graph of the codebase
```

---

## 🧩 The DDD backend (bounded contexts)

The `backend/` package is organized as **Domain‑Driven Design bounded contexts**.
Each context (`deck`, `term`, `user`, `learning`, `role`, `folder`, `speaking`,
`course`, `reminders`) has the same internal layering, and they talk to each
other only through small **Context APIs** (or another context's application
service, injected at the composition root) — never by reaching into each other's
internals. Simple contexts (e.g. `reminders`) may omit the `domain/` layer; when
present, `domain/` stays **pure Python** with no Django/ORM/I/O imports.

```mermaid
flowchart LR
    subgraph ctx["A bounded context (e.g. term/)"]
        direction TB
        D["🎯 domain/<br/>access policies, rules<br/><i>no framework deps</i>"]
        A["⚙️ application/<br/>services, use-cases,<br/>context_api, AI orchestration"]
        I["🔌 infrastructure/<br/>repository, SQL queries,<br/>ES search"]
        A --> D
        A --> I
    end

    CR["🧩 shared/composition.py<br/><b>Composition Root</b><br/>wires repos + ports into services"]
    V["🚪 views/ (DRF ViewSets)"]

    V --> CR
    CR --> A
```

**How a context is wired** — the composition root is the single place where
abstract *ports* meet concrete *adapters*:

```mermaid
flowchart TB
    subgraph compose["shared/composition.py"]
        TS["term_service = TermService(repo, image_storage, learning_context)"]
        DS["deck_service = DeckService(repo, user_context, learning_context)"]
        LS["learning_service = LearningService(repo, term_context, user_context, cache)"]
        TE["term_enrichment_service = TermEnrichmentService(ai=default_ai_provider)"]
        SC["speaking_coach_service = SpeakingCoachService(ai, pronunciation=AzureSpeech?)"]
        SS["speaking_service = SpeakingService(coach=speaking_coach_service, repo)"]
        CS["course_service = CourseService(repo, speaking_service, ai, tts=AzureTTS?, image_storage)"]
        RS["reminder_service = ReminderService(repo)"]
    end

    Ports["📜 application/ports.py<br/>AiTextPort · CachePort ·<br/>ImageStoragePort · OAuthPort"]
    Adapters["🔌 infrastructure adapters<br/>Gemini · OpenRouter · ElevenLabs ·<br/>Azure Speech/TTS · Redis cache ·<br/>Cloudinary · Google OAuth"]

    Ports -. implemented by .-> Adapters
    Adapters --> compose
```

> [!IMPORTANT]
> **Why this matters:** services depend on **Protocols (ports)**, not concrete
> classes. That's why the AI provider can be swapped (Gemini ↔ OpenRouter), the
> cache can fall back from Redis to in‑process, and tests can inject fakes —
> all without touching business logic.

**The 10 most connected "god nodes"** (from the codebase knowledge graph) tell
you where the gravity is:

```mermaid
flowchart LR
    TS["TermService<br/>27 edges"]:::hot
    DS["DeckService<br/>24"]:::hot
    AE["AiProviderError<br/>22"]:::hot
    SV["SpeakingViewSet<br/>20"]:::warm
    DAP["DeckAccessPolicy<br/>17"]:::warm
    VE["ValidationError<br/>17"]:::warm
    TR["TermRepository<br/>16"]:::warm
    LS["LearningService<br/>15"]:::warm
    RHP["RetryingHttpProvider<br/>15"]:::warm

    classDef hot fill:#7c2d12,stroke:#f97316,color:#fff
    classDef warm fill:#1e3a5f,stroke:#60a5fa,color:#fff
```

---

## 🗂️ Data model (ER diagram)

All entities use **UUID primary keys** and timestamp mixins (`base/models`).

```mermaid
erDiagram
    USER ||--o{ DECK : "owns"
    USER ||--o{ FOLDER : "owns"
    USER ||--o{ USER_DECK_ROLE : "has"
    DECK ||--o{ USER_DECK_ROLE : "grants"
    USER }o--o{ DECK : "member via UserDeckRole"
    DECK ||--o{ TERM : "contains"
    FOLDER }o--o{ DECK : "groups"
    USER ||--o{ USER_LEARNING_PROGRESS : "tracks"
    TERM ||--o{ USER_LEARNING_PROGRESS : "measured by"
    USER ||--|| USER_SETTING : "configures"
    USER ||--o{ SPEAKING_CONVERSATION : "practices"
    SPEAKING_CONVERSATION ||--o{ SPEAKING_ANALYSIS : "scored by"
    USER ||--o{ SPEAKING_ANALYSIS : "earns"
    COURSE ||--o{ COURSE_SECTION : "contains"
    COURSE_SECTION ||--o{ COURSE_LESSON : "contains"
    USER ||--o{ USER_COURSE_LESSON_PROGRESS : "progresses"
    COURSE_LESSON ||..o{ USER_COURSE_LESSON_PROGRESS : "keyed by lesson_key"

    USER {
        uuid id PK
        string email
        string name
    }
    DECK {
        uuid id PK
        string name
        string field
        bool is_public
        image background
        uuid owner_FK
    }
    TERM {
        uuid id PK
        string name
        text meaning
        string word_type
        string pronunciation
        text definition
        json synonyms_antonyms_examples
        json word_forms_family
        bool ai_filled
        uuid deck_FK
    }
    USER_DECK_ROLE {
        uuid id PK
        char role "O=owner E=edit V=view"
        uuid user_FK
        uuid deck_FK
    }
    USER_LEARNING_PROGRESS {
        uuid id PK
        int score
        int total_revisions
        bool is_skip
        datetime last_revised_at
    }
    SPEAKING_CONVERSATION {
        uuid id PK
        string topic
        string accent_level_tone
        json lines
        json highlights
        bool starred
    }
    SPEAKING_ANALYSIS {
        uuid id PK
        int accuracy_fluency_completeness
        int words_per_minute
        json word_analysis
        json key_struggles
    }
    SPEAKING_AUDIO_CLIP {
        uuid id PK
        string voice
        string text_hash "unique w/ voice"
        text audio "base64 PCM"
    }
    AI_RESPONSE_CACHE {
        uuid id PK
        string context
        string request_hash
        json response
    }
    COURSE {
        uuid id PK
        slug slug "unique"
        string title
        string level "e.g. A2 / B1"
        image background
    }
    COURSE_SECTION {
        uuid id PK
        slug slug
        string title
        int order
        uuid course_FK
    }
    COURSE_LESSON {
        uuid id PK
        string key "unique natural key (re-crawl safe)"
        string title
        json characters "name, voice, art layers"
        json lines "speaker, text, voice"
        json exercises
        uuid section_FK
    }
    USER_COURSE_LESSON_PROGRESS {
        uuid id PK
        string lesson_key "= CourseLesson.key (no FK)"
        char status "in_progress / passed"
        int best_score
        int attempts
        json last_result "replayed role-play breakdown"
        json highlights
    }
```

**Course progress is decoupled from content:** `UserCourseLessonProgress` is keyed
on the lesson's stable string `lesson_key` (not a row FK), so a clean re‑crawl can
delete and recreate every lesson row without ever cascading away a learner's
role‑play progress.

**Sharing model:** access to a deck is governed by `UserDeckRole` with three
roles, enforced by the framework‑independent `DeckAccessPolicy` in the domain
layer:

```mermaid
flowchart LR
    O["👑 OWNER<br/>full control + delete + invite"] --> E["✏️ EDIT<br/>add/edit terms"] --> V["👁️ VIEW<br/>study only"]
    Pub["🌍 is_public deck"] -.->|anyone can| Clone["clone into own library"]
```

---

## 🔄 Request lifecycle

A typical authenticated REST call from the SPA to the database:

```mermaid
sequenceDiagram
    autonumber
    participant U as ⚛️ React (axios)
    participant N as 🔀 Nginx
    participant DRF as 🚪 DRF ViewSet
    participant Auth as 🔐 CustomTokenAuth
    participant Svc as ⚙️ Application Service
    participant Pol as 🎯 AccessPolicy
    participant Repo as 🔌 Repository
    participant DB as 🗄️ MySQL
    participant Cache as ⚡ Redis

    U->>N: HTTP + Bearer token
    N->>DRF: proxy /api/...
    DRF->>Auth: authenticate(token)
    Auth-->>DRF: User
    DRF->>Svc: call use-case (via composition root)
    Svc->>Pol: can_view / can_edit?
    Pol-->>Svc: ✅ / ❌ PermissionDenied
    Svc->>Cache: get(key)
    alt cache hit
        Cache-->>Svc: cached payload ⚡
    else cache miss
        Svc->>Repo: query
        Repo->>DB: SQL (ORM or SQLAlchemy)
        DB-->>Repo: rows
        Repo-->>Svc: domain objects
        Svc->>Cache: set(key, payload)
    end
    Svc-->>DRF: DTO
    DRF-->>U: JSON (serialized)
```

**Auth note:** FlashLearn uses **custom token auth** (not the standard
SimpleJWT flow). `POST /api/users/login` returns a token; `SECRET_KEY` signs it
and is shared with the Rust backend so tokens are interchangeable. Google OAuth
is available at `POST /api/users/google_login`.

### Key API routes

| Route | Purpose |
|-------|---------|
| `/api/decks/` · `/api/terms/` · `/api/folders/` | CRUD via DRF router |
| `/api/users/login` · `/api/users/google_login` | Custom token & OAuth login |
| `/api/learnings/` | Learning progress & revision |
| `/api/roles/` | Deck membership / invites |
| `/api/speaking/` | Speaking Coach (dialogue, TTS, analysis, history) |
| `/api/courses/` | Guided courses: catalog, content, lesson audio, Live Role‑play scoring |
| `/api/reminders/` | Home‑page "pick up where you left off" prompts |
| `/api/images/` | Image crawler (Google/Bing/Openverse/Wikimedia) |
| `/api/translate/` | Translation |
| `/ws/quick-revise/` | WebSocket multiplayer game |
| `/api/swagger/` | API docs (DEBUG only) |

---

## 🤖 The AI engine

AI is treated as **infrastructure behind a port**. Application services
(`TermEnrichmentService`, `SpeakingCoachService`) depend only on `AiTextPort` —
the concrete provider is chosen at the composition root and protected by two
resilience layers: **failover** and a **cross‑process rate gate**.

### Provider selection & failover

```mermaid
flowchart TB
    Start["get_ai_provider()"] --> Chain["build chain from env<br/>AI_PROVIDER + AI_FALLBACK_PROVIDERS"]
    Chain --> Cfg{"how many<br/>configured?"}
    Cfg -->|"0"| Err["return primary<br/>(raises clear error)"]
    Cfg -->|"1"| Single["use it directly"]
    Cfg -->|"2+"| Failover["wrap in FailoverAiProvider<br/>primaries get fast_retries,<br/>last keeps full retry budget"]

    subgraph fo["FailoverAiProvider.generate_json()"]
        direction TB
        P1["1️⃣ Gemini"] -->|"AiProviderError"| Cool1["cooldown 120s<br/>⏳ skip next time"]
        Cool1 --> P2["2️⃣ OpenRouter"]
        P2 -->|"success ✅"| Done["clear cooldown, return"]
        P2 -->|"all cooling down"| FailFast["fail fast:<br/>'retry in ~Ns'"]
    end

    Failover --> fo
```

> [!TIP]
> A provider that fails gets a **120s cooldown** so the next request skips it
> instead of paying its retry/backoff again — crucial when the primary is
> rate‑limited for a sustained window. If *everything* is cooling down, the call
> **fails fast** with a "retry in ~Ns" message instead of hanging.

### The global rate gate (Redis‑backed)

Free‑tier AI quotas are strict, and multiple Django/worker processes share them.
A **Redis Lua‑scripted gate** enforces *one‑at‑a‑time + requests‑per‑minute*
**across all processes**, degrading gracefully to an in‑process gate if Redis is
unavailable.

```mermaid
sequenceDiagram
    autonumber
    participant P1 as Process A
    participant P2 as Process B
    participant Gate as 🚦 GlobalAiGate (Redis Lua)
    participant AI as 🤖 Provider

    P1->>Gate: acquire single-flight slot
    P2->>Gate: acquire single-flight slot
    Gate-->>P1: 🔓 token (you go first)
    Gate--xP2: ⏳ blocked, waiting
    P1->>Gate: consume 1 RPM token (sleep if none)
    P1->>AI: generate_json(...)
    AI-->>P1: result
    P1->>Gate: release slot
    Gate-->>P2: 🔓 token (your turn)
    P2->>AI: generate_json(...)
```

### Provider capability matrix

| Provider | Text / JSON | Multimodal (audio in) | TTS (audio out) | Role |
|----------|:-----------:|:---------------------:|:---------------:|------|
| **Gemini** | ✅ | ✅ | ✅ | Primary text/JSON + multimodal listener; legacy TTS voices |
| **OpenRouter** | ✅ | ❌ | ❌ | Text/JSON fallback (free tier by default) |
| **ElevenLabs** | ❌ | ❌ | ✅ | Active Speaking‑Coach tutor TTS (US/UK/AU voices) |
| **Azure Speech** | ❌ | ✅ | ❌ | *Measured* pronunciation assessment (accuracy/fluency/phonemes) |
| **Azure TTS** | ❌ | ❌ | ✅ | Per‑character course dialogue voices |

> [!NOTE]
> Only **Gemini** and **OpenRouter** sit in the env‑driven failover chain
> (`AI_PROVIDER` / `AI_FALLBACK_PROVIDERS`). **ElevenLabs**, **Azure Speech**, and
> **Azure TTS** are single‑purpose adapters wired directly at the composition
> root and used only when their credentials are present — each degrades
> gracefully (e.g. Azure pronunciation falls back to the Gemini multimodal
> listener; ElevenLabs falls back to legacy Gemini voices).

AI responses are also persisted in `AiResponseCache`, keyed by a stable
`sha256(context + request inputs)` so identical generations are never paid for
twice. Synthesized speech is cached forever in `SpeakingAudioClip`
(keyed by `voice + text_hash`), shared by both the Speaking Coach and course
dialogue audio.

---

## ✨ AI flow 1 — Term enrichment

Turn a bare word (`"oil"`) into a full Oxford‑style flashcard. The
`TermEnrichmentService` owns the prompt, rules, and a strict JSON schema so the
frontend stays a pure UI layer.

```mermaid
flowchart TB
    In["✏️ User types a term<br/>(or AI Assistant batch)"] --> Svc["TermEnrichmentService"]
    Svc --> Prompt["build system prompt + rules<br/>+ ENRICHMENT_SCHEMA"]
    Prompt --> Gate["🚦 rate gate"] --> AI["🤖 AI provider (failover)"]
    AI --> JSON["structured JSON"]
    JSON --> Norm["normalize & validate<br/>(_normalize, _as_str_list)"]
    Norm --> Fields

    subgraph Fields["📇 Enriched Term"]
        direction LR
        WT["word_type"] ~~~ PR["pronunciation /IPA/"]
        DF["definition"] ~~~ SY["synonyms · antonyms"]
        EX["examples<br/>(main word in &lt;b&gt;…&lt;/b&gt;)"] ~~~ WF["word_forms · word_family"]
    end

    Fields --> Save["save Term · ai_filled = true"]
    Save --> UI["⚛️ rendered flashcard"]
```

**Smart rules baked into the prompt:** single words get full grammatical data;
phrases/idioms/acronyms focus on definition + examples (e.g. `GOAT → "Greatest
Of All Time"`); every example wraps the term in `<b>…</b>` for highlighting; it
never translates the native‑language meaning. A backfill cron enriches any
terms still missing data, skipping ones where `ai_filled` is already set.

---

## 🗣️ AI flow 2 — The Speaking Coach

The marquee feature: generate a natural dialogue, let the user **record
themselves**, and get **per‑word pronunciation scoring** with IPA, mouth tips,
and rhythm — powered by Gemini's multimodal + TTS capabilities.

```mermaid
flowchart TB
    subgraph gen["1 · Generate dialogue"]
        Topic["pick topic + accent + level + tone"] --> GenAI["🤖 SpeakingCoachService<br/>_CONVERSATION_SCHEMA"]
        GenAI --> Lines["💬 lines[] {id, speaker, text}"]
    end

    subgraph tts["2 · Hear the tutor"]
        Lines --> Clip{"clip cached?<br/>(voice, text_hash)"}
        Clip -->|hit| Play["🔊 replay cached audio"]
        Clip -->|miss| Synth["🤖 ElevenLabs TTS (per line)<br/>legacy: Gemini voices"]
        Synth --> Store[("SpeakingAudioClip<br/>cache forever")]
        Store --> Play
    end

    subgraph rec["3 · Practice & score"]
        Play --> Rec["🎙️ user records audio"]
        Rec --> Assess{"Azure Speech<br/>configured?"}
        Assess -->|yes| Azure["📐 Azure measured assessment<br/>(accuracy/fluency/phonemes)"]
        Assess -->|no| Listen["🤖 Gemini multimodal listener<br/>(fallback)"]
        Azure --> Scores["📊 accuracy · fluency · completeness<br/>· rhythm · WPM"]
        Listen --> Scores
        Azure --> Words["🔤 per-word: status, IPA target/spoken,<br/>mouth tip, syllable stress"]
        Listen --> Words
        Scores --> Hist[("SpeakingAnalysis<br/>saved history")]
        Words --> Hist
    end

    gen --> tts --> rec
```

> [!NOTE]
> **Why audio is cached per‑line:** TTS is a billed call and a sentence renders
> identically every time, so the coach synthesizes **one clip per line** and
> stores it in `SpeakingAudioClip` (shared across all users, keyed by
> `voice + text_hash`) — replayed forever, generated once. The same cache backs
> the guided‑course dialogue audio (see below).

Conversations are saved to history (star, note words/phrases, reopen by URL),
and the coach can surface **your own deck terms** that appear in a dialogue.

### Guided courses & Live Role‑play

The `course` context reuses the same engine to teach structured, level‑based
curricula (imported from freeCodeCamp via `crawl_english_courses`). Each lesson
is a dialogue scene: characters get a fixed **Azure TTS** voice matching their
gender (assigned once by `generate_course_audio`), and the learner passes a
lesson by recording a **Live Role‑play** that `CourseService` scores
sentence‑by‑sentence through the Speaking Coach's pronunciation analysis. A
lesson flips to *passed* only when the averaged score clears
`COURSE_PASS_THRESHOLD` (a pure rule in `course/domain/progress.py`); the latest
breakdown is persisted so the lesson page can replay it on revisit.

---

## 🎮 Realtime: the Quick‑Revise game

A multiplayer race over **Django Channels + Daphne**, with Redis as the channel
layer. Players answer revision questions against a per‑term **time limit** that
adapts to difficulty.

```mermaid
sequenceDiagram
    autonumber
    participant C as ⚛️ Player
    participant WS as 🎮 QuickReviseConsumer
    participant R as ⚡ Redis (channel layer)
    participant DB as 🗄️ MySQL

    C->>WS: connect /ws/quick-revise/ (token + deck)
    WS->>DB: get_user_and_deck + get_revise_terms
    WS->>WS: build GameState
    loop each term
        WS->>WS: calculate_time_limit (base + leftover)
        WS-->>C: send_next(question, ⏱️ limit)
        C->>WS: handle_answer(choice, elapsed)
        WS->>WS: score (speed-weighted)
        WS->>DB: save_learning_progress
        WS-->>C: result + running score
    end
    WS-->>C: 🏁 game over + leaderboard
```

The time limit is computed from a base time plus carried‑over leftover time, so
fast players bank time and harder terms get more of it.

---

## 🧠 Learning & spaced revision

Every `(user, term)` pair has a `UserLearningProgress` row driving what to study
next. Services adjust `score` on correct/incorrect answers, track
`total_revisions`, and let users `skip` mastered terms.

```mermaid
stateDiagram-v2
    [*] --> New: term added to deck
    New --> Learning: first studied
    Learning --> Reinforcing: ✅ record_correct (score↑)
    Reinforcing --> Learning: ❌ record_incorrect (score↓)
    Reinforcing --> Mastered: score high & stable
    Mastered --> Skipped: toggle_skip
    Skipped --> Learning: un-skip
    Learning --> Learning: quick-revise answer
    Mastered --> [*]
```

Progress reads are **cache‑first** (`_LearningProgressCache` over Redis) with an
hourly cron evicting stale entries, and the `LearningService` composes data from
the `term` and `user` contexts via their Context APIs — never direct imports.

---

## ⚛️ Frontend architecture

A Material‑UI SPA with a clean separation between **pages**, a typed **API
service layer**, global **Redux** state, and **server state** via TanStack Query.

```mermaid
flowchart TB
    subgraph app["frontend/src"]
        Pages["📄 pages/<br/>home · deckDetail · login · folder · invite"]
        subgraph deck["pages/home/deckDetail/"]
            Learn["learn/"] ~~~ Revise["revise/ (quiz · fill · quickRevise)"]
            Speak["speakingCoach/"] ~~~ NumTest["numberTest/"]
            Edit["editDeck/"]
        end
        Comp["🧱 components/<br/>navBar · aiAssistant · guideTour · dragonAvatar"]
        API["🔌 api-service/<br/>deck · term · learning · speaking · auth · crawler …"]
        HTTP["📡 httpRequest.js<br/>axios + token refresh queue"]
        Store["🗃️ Redux Toolkit store"]
        Theme["🎨 themeController.js<br/>CSS vars: light/dark + palettes"]
        Tours["🐉 tours.js<br/>onboarding registry"]
    end

    Backend["🐍 / 🦀 Backend API"]

    Pages --> Comp
    Pages --> API
    API --> HTTP --> Backend
    Pages --> Store
    Pages --> Theme
    Pages --> Tours
```

**Three frontend conventions enforced by project rules:**

| 🎨 Theming | 📱 Responsive | 🐉 Onboarding tour |
|-----------|--------------|--------------------|
| All UI uses **theme tokens** (`var(--fl-text)`, `$main-purple`) so it adapts to light/dark + every palette. No hardcoded brand colors. | Mobile‑first; verified at ~375px. No fixed widths wider than a phone; rows wrap/stack; tap targets ≥44px. | "Dragon's tour" highlights real elements via `data-tour`. New page → new tour required; changed element → update its step. |

> **Doc‑only change note:** this guide adds Markdown only and touches no UI, so
> **no onboarding‑tour update is needed.**

---

## ⏰ Background jobs & cron

One **worker process** runs both the RQ worker (main thread) and the RQ
scheduler (daemon thread). Redis is the queue.

```mermaid
flowchart LR
    subgraph wp["🛠️ Worker process (manage.py start_worker)"]
        Sched["⏰ Scheduler thread<br/>pushes cron jobs on schedule"]
        Wkr["⚙️ Worker thread<br/>executes queued jobs"]
    end
    Redis[("⚡ Redis queue")]
    Sched --> Redis --> Wkr
    Wkr --> Mail["📧 daily study reminders"]
    Wkr --> CacheJob["🧹 cleanup learning cache"]
    Wkr --> Backfill["✨ AI backfill missing terms"]
    Wkr --> Backup["💾 DB dump → Google Drive"]
```

| Job | Schedule | Purpose |
|-----|----------|---------|
| `daily_reminders` | `0 1 * * *` | Email users who haven't studied today |
| `cleanup_learning_cache` | `0 * * * *` | Evict stale learning‑progress cache |

Define new schedules in `backend/cron.py → register_jobs()`. The
`dispatch()` helper enqueues a job if a worker is live, otherwise runs it inline.

---

## 🧩 Chrome extension

Select text on **any** web page → translate → save to your default deck.

```mermaid
sequenceDiagram
    autonumber
    participant Site as 🌐 Any web page
    participant CS as 🧩 Content script
    participant Pop as 🪟 Popup (React)
    participant API as 🐍 FlashLearn API

    Pop->>Site: "Connect Account" opens web app
    Site-->>CS: login token syncs back
    Note over Pop: pick default deck + language
    Site->>CS: user selects text → clicks 🐉 icon
    CS->>API: translate + create term
    API-->>CS: saved ✅ to default deck
```

Built on Chrome MV3 + React. The web‑app URL must appear in
`manifest.json` content‑script matches so the auth token can sync after login.

---

## 🚢 Deployment

Multiple Docker Compose profiles cover every scenario; Nginx routes to whichever
backend is active.

```mermaid
flowchart LR
    subgraph compose["docker-compose"]
        DB[("MySQL")] --- RD[("Redis")] --- BE["backend"] --- WK["worker"] --- FE["frontend"]
    end
    Hub["🐳 Docker Hub<br/>ngovandong/flashlearn_*"]
    BE -. build.sh push .-> Hub
    FE -. build.sh push .-> Hub
```

| File | Use |
|------|-----|
| `docker-compose.yml` | Production — db, redis, backend, worker, frontend |
| `docker-compose.dev.yml` | Dev hot‑reload (mounts local code) |
| `docker-compose.dockerhub.*.selfservice.yml` | Run pre‑built Hub images (ARM64/AMD64) |

Build & push with `DOCKER=podman ./build.sh [--platform linux/arm64]`.

---

<div align="center">

### 🧭 Where to go next

**Build & run commands · env vars** → [`CLAUDE.md`](./CLAUDE.md) &nbsp;·&nbsp;
**AI‑agent rules** → [`AGENTS.md`](./AGENTS.md) &nbsp;·&nbsp;
**Worker / Docker / testing** → [`README.md`](./README.md) &nbsp;·&nbsp;
**Codebase knowledge graph** → [`graphify-out/GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md)

<sub>Diagrams authored in Mermaid · Generated for the FlashLearn project 🐉</sub>

</div>
