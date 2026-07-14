# AGENTS.md — Universal AI agent guide for FlashLearn

This is the **single source of truth for AI coding tools** working in this repo
(Cursor, Claude Code, GitHub Copilot, Gemini CLI, Antigravity, Codex, etc.).
Any agent — regardless of harness — MUST read and follow the rules below.

Tool-specific entrypoints (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`) all point back to this file so the guidance
stays identical everywhere. Keep this file in sync when rules change.

## Commands, architecture & setup

See **`CLAUDE.md`** for build/run commands, env vars, and the full architecture
overview (Django + Rust backends, React frontend, worker, Docker).

## Project rules — always check before finishing a change

The authoritative, detailed rules live in `.cursor/rules/*.mdc`. They are plain
Markdown (with a small YAML frontmatter header) and are readable by any tool —
**open the linked file for the full rule.** Summaries:

### 1. Theme adherence (frontend) — `.cursor/rules/frontend-theming.mdc`
Applies to `frontend/apps/web/src/**`. The app is themeable at runtime (light/dark +
palette) via CSS custom properties. All new/updated UI MUST use theme tokens —
never hardcode brand/neutral/surface/text/border colors.
- SCSS: use Sass aliases (`$main-purple`, `$surface`, `$main-text-color`, …) and
  the `@mixin`s (`card`, `purple_btn`, …) from `base/_variables.scss` & `_mixins.scss`.
- JS/MUI `sx`: reference CSS vars directly (`var(--fl-text)`,
  `var(--fl-surface)`; translucency via `rgba(var(--fl-primary-rgb), 0.12)`).
- Only static *semantic* colors (success green, `$error-red`) may stay hardcoded.

### 2. Mobile responsiveness (frontend) — `.cursor/rules/responsive-mobile.mdc`
Applies to `frontend/apps/web/src/**`. The app renders at `width=device-width`, so every
screen is used on phones. New/updated UI MUST adapt to small viewports (verify
at ~375px) with no horizontal scroll, overflow, or overlap.
- Global overrides → `styles/sass/base/_media_queries.scss`; component-local
  overrides → nested `@media` in that component's partial.
- Reuse existing breakpoints (`480 / 600 / 725 / 850 / 900 / 960px`),
  desktop-first `max-width`.
- No fixed widths wider than a phone (use `%`/`max-width`/`min()`); wrap or stack
  flex rows on mobile; keep tap targets ≥44px; use MUI responsive props
  (`{ xs, sm }`) instead of static values.

### 3. Onboarding tour / user guide (frontend) — `.cursor/rules/user-guide.mdc`
Applies to `frontend/apps/web/src/**`. The in-app "Dragon's tour" highlights real UI
elements. Before finishing any frontend change, REVIEW whether the tour needs
updating and state your decision (e.g. "no guide update needed").
- New page/route → a tour is REQUIRED. Renamed/moved/removed element or changed
  `data-tour`/selector → update the step. Register tours in `constants/tours.js`
  and mark targets with `data-tour="..."`.

### 4. Backend layering (Django) — `.cursor/rules/backend-architecture.mdc`
Applies to `backend/**`. The Django backend is organized into DDD / clean-architecture
bounded contexts (`deck/`, `term/`, `speaking/`, …). All new/updated backend code MUST
respect the layers — never regress to fat views that hit the ORM directly.
- **Views** (`backend/views/**`) are thin: parse the request, call an application-service
  singleton, serialize, map errors to status codes. No business logic, no ORM.
- **Application** (`<context>/application/services.py`) holds the use case + rules with
  constructor-injected dependencies. **Infrastructure** (`<context>/infrastructure/repository.py`)
  is the *only* place ORM access is allowed. **Ports** (`shared/application/ports.py`)
  abstract external I/O; cross-context reads go through `context_api.py`.
- Wire every service in `shared/composition.py` and expose it via `backend/services/__init__.py`.

### 5. Knowledge graph — `.cursor/rules/graphify.mdc`
Applies repo-wide. Before answering architecture/codebase questions, read
`graphify-out/GRAPH_REPORT.md`. After modifying code files in a session, rebuild
the graph:
```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

## When you add a new rule

1. Add the detailed rule as `.cursor/rules/<name>.mdc` (with frontmatter:
   `description`, `globs`, `alwaysApply`).
2. Add a short summary + link here in `AGENTS.md` so every tool inherits it.
