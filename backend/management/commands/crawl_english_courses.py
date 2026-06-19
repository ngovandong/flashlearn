"""Import the freeCodeCamp English-for-Developers courses into our Course models.

Source of truth is freeCodeCamp's open curriculum, served as Gatsby page-data
JSON. For each superblock we fetch one lightweight listing (every challenge +
ordering), then fetch each dialogue/task's full page-data to extract the scene,
transcript lines, characters and follow-up exercises.

Character art + scene backgrounds are mirrored into our own Cloudinary as we go
(idempotently) so the app never depends on freeCodeCamp's CDN at runtime. We do
NOT use freeCodeCamp's audio — dialogue audio is generated afterwards per
character via Azure TTS (run ``generate_course_audio`` once this import is done).

Lessons are keyed by a stable natural slug (e.g.
``b1-english-for-developers/learn-.../dialogue-1-...``); user role-play progress
is keyed on that slug, so ``--clean`` + a fresh re-crawl never loses progress.

``--clean`` only deletes the targeted superblock course slugs (a2/b1); it never
touches the locally-seeded practical courses (``seed_practical_courses``) nor any
Cloudinary image. Those seeded courses reuse the same mirrored character/scene
assets, and re-mirroring here is idempotent (same ``public_id``), so their images
stay valid across re-crawls.

Usage:
    uv run python manage.py crawl_english_courses
    uv run python manage.py crawl_english_courses --courses a2 --limit-lessons 2
    uv run python manage.py crawl_english_courses --clean --workers 12
    # then: uv run python manage.py generate_course_audio
"""

import html
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import PurePosixPath
from threading import Lock

import requests
from django.core.management.base import BaseCommand
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from backend.services import course_service


def make_session(workers: int) -> requests.Session:
    """A pooled session that retries transient errors (incl. connection resets).

    freeCodeCamp resets connections under bursty concurrency; urllib3's Retry
    handles connect/read errors and 429/5xx with exponential backoff so a single
    reset no longer leaves a lesson blank.
    """
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=workers, pool_maxsize=workers)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


PAGE_DATA = "https://www.freecodecamp.org/page-data{slug}/page-data.json"
SUPERBLOCK_DATA = "https://www.freecodecamp.org/page-data/learn/{superblock}/page-data.json"
ANIM_BASE = "https://cdn.freecodecamp.org/curriculum/english/animation-assets/images"
HEADERS = {"User-Agent": "FlashLearn-course-importer/1.0"}

# A neutral, non-talking character layer stack mirrored per character. Layers a
# character lacks (e.g. no glasses) 404 and are simply skipped.
CHAR_LAYERS = ("base", "brows-normal", "eyes-open", "mouth-smile", "glasses")

# freeCodeCamp challenge types we import.
TYPE_DIALOGUE = 21
TYPE_FILL_BLANK = 22
TYPE_CHOICE = 19

COURSES = {
    "a2": {
        "superblock": "a2-english-for-developers",
        "title": "A2 English for Developers",
        "level": "A2",
        "order": 1,
        "description": (
            "Elementary workplace English through short office dialogues. "
            "Listen, study the transcript, then pass each lesson with a Live Role-play."
        ),
    },
    "b1": {
        "superblock": "b1-english-for-developers",
        "title": "B1 English for Developers",
        "level": "B1",
        "order": 2,
        "description": (
            "Intermediate workplace English through realistic professional dialogues. "
            "Listen, study the transcript, then pass each lesson with a Live Role-play."
        ),
    },
}

_STOPWORDS = {"a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with", "your"}
_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(value: str) -> str:
    if not value:
        return ""
    text = _TAG_RE.sub("", value)
    return html.unescape(text).strip()


def humanize_block(slug: str) -> str:
    words = slug.replace("learn-", "", 1).split("-")
    titled = [w if w in _STOPWORDS else w.capitalize() for w in words]
    if titled:
        titled[0] = titled[0].capitalize()
    return " ".join(titled)


def character_folder(name: str) -> str:
    return (name or "").strip().lower().replace(" ", "-")


class AssetMirror:
    """Mirrors freeCodeCamp character/background art into our Cloudinary once.

    Thread-safe and deduplicated: each character (and background) is mirrored a
    single time per run, and Cloudinary uploads are idempotent across runs.
    """

    def __init__(self, session: requests.Session):
        self._session = session
        self._chars: dict[str, dict] = {}
        self._backgrounds: dict[str, str] = {}
        self._exists: dict[str, bool] = {}
        self._lock = Lock()

    def _source_exists(self, url: str) -> bool:
        with self._lock:
            if url in self._exists:
                return self._exists[url]
        ok = False
        try:
            resp = self._session.get(url, timeout=30, stream=True)
            ok = resp.status_code == 200
            resp.close()
        except requests.RequestException:
            ok = False
        with self._lock:
            self._exists[url] = ok
        return ok

    def character_images(self, name: str) -> dict:
        folder = character_folder(name)
        if not folder:
            return {}
        with self._lock:
            if name in self._chars:
                return self._chars[name]
        images = {}
        for layer in CHAR_LAYERS:
            src = f"{ANIM_BASE}/characters/{folder}/{layer}.png"
            if not self._source_exists(src):
                continue
            url = course_service.mirror_image(src, f"flashlearn/courses/characters/{folder}/{layer}")
            if url:
                images[layer] = url
        with self._lock:
            self._chars[name] = images
        return images

    def background_url(self, filename: str) -> str:
        if not filename:
            return ""
        with self._lock:
            if filename in self._backgrounds:
                return self._backgrounds[filename]
        src = f"{ANIM_BASE}/backgrounds/{filename}"
        url = ""
        if self._source_exists(src):
            stem = PurePosixPath(filename).stem
            url = course_service.mirror_image(src, f"flashlearn/courses/backgrounds/{stem}")
        with self._lock:
            self._backgrounds[filename] = url
        return url


class Command(BaseCommand):
    help = "Import the freeCodeCamp A2/B1 English-for-Developers courses."

    def add_arguments(self, parser):
        parser.add_argument("--courses", default="a2,b1", help="Comma list of course keys (a2,b1).")
        parser.add_argument(
            "--limit-lessons", type=int, default=0, help="Max lessons per course (0 = all). Use 1-2 to test."
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=6,
            help="Parallel fetch/mirror threads. Keep modest (<=8); freeCodeCamp resets bursty connections.",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete the targeted courses' content before re-crawling (user progress is kept).",
        )
        parser.add_argument("--delay", type=float, default=0.0, help="Seconds to sleep between requests.")

    def handle(self, *args, **opts):
        self.delay = opts["delay"]
        self.limit = opts["limit_lessons"]
        self.workers = max(1, opts["workers"])
        self.session = make_session(self.workers)
        self.mirror = AssetMirror(self.session)
        keys = [k.strip() for k in opts["courses"].split(",") if k.strip()]
        cfgs = [COURSES[k] for k in keys if k in COURSES]
        for k in keys:
            if k not in COURSES:
                self.stderr.write(f"Unknown course '{k}' (expected one of {list(COURSES)})")

        if opts["clean"] and cfgs:
            slugs = [c["superblock"] for c in cfgs]
            course_service.clean_courses(slugs)
            self.stdout.write(self.style.WARNING(f"Cleaned existing content for: {', '.join(slugs)}"))

        for cfg in cfgs:
            self.import_course(cfg)

    # ── Per course ────────────────────────────────────────────────────────
    def import_course(self, cfg):
        self.stdout.write(self.style.MIGRATE_HEADING(f"Importing {cfg['title']}…"))
        nodes = self._fetch_listing(cfg["superblock"])
        if not nodes:
            self.stderr.write(f"  No challenges found for {cfg['superblock']}.")
            return

        course = course_service.import_course(
            slug=cfg["superblock"],
            defaults={
                "title": cfg["title"],
                "level": cfg["level"],
                "description": cfg["description"],
                "source": "freecodecamp",
                "order": cfg["order"],
            },
        )

        items = self._plan(nodes)
        if not items:
            self.stderr.write("  No dialogue lessons found.")
            return

        # Network-bound work (page-data fetches + Cloudinary mirroring) in parallel.
        built: list[dict | None] = [None] * len(items)
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(self._build_lesson, it): i for i, it in enumerate(items)}
            for future in as_completed(futures):
                i = futures[future]
                try:
                    built[i] = future.result()
                except Exception as exc:  # noqa: BLE001 — keep going on a single bad lesson
                    self.stderr.write(f"  build failed for {items[i]['dialogue'].get('dashedName')}: {exc}")

        # DB writes happen sequentially in the main thread.
        sections = {}
        saved = 0
        for it, data in zip(items, built, strict=True):
            if data is None:
                continue
            block = it["block_slug"]
            section = sections.get(block)
            if section is None:
                section = course_service.import_section(
                    course=course,
                    slug=block,
                    defaults={"title": humanize_block(block), "order": it["section_order"]},
                )
                sections[block] = section
            course_service.import_lesson(key=data["key"], defaults={**data["defaults"], "section": section})
            saved += 1

        self.stdout.write(self.style.SUCCESS(f"  Done: {saved} lessons across {len(sections)} sections."))

    def _plan(self, nodes):
        """Ordered list of lessons to import: each dialogue with its follow-up tasks."""
        items = []
        section_order = 0
        for block_slug, challenges in self._group_blocks(nodes):
            if not any(c["challengeType"] == TYPE_DIALOGUE for c in challenges):
                continue
            lesson_order = 0
            current = None
            for ch in challenges:
                ctype = ch["challengeType"]
                if ctype == TYPE_DIALOGUE:
                    current = {
                        "block_slug": block_slug,
                        "section_order": section_order,
                        "lesson_order": lesson_order,
                        "dialogue": ch,
                        "tasks": [],
                    }
                    items.append(current)
                    lesson_order += 1
                elif ctype in (TYPE_FILL_BLANK, TYPE_CHOICE) and current is not None:
                    current["tasks"].append(ch)
            section_order += 1
        return items[: self.limit] if self.limit else items

    # ── Builders (run in worker threads — no ORM access) ───────────────────
    def _build_lesson(self, item):
        ch = item["dialogue"]
        detail = self._fetch_detail(ch["fields"]["slug"])
        scene = (detail or {}).get("scene") or {}

        lines = []
        for cmd in scene.get("commands") or []:
            dialogue = cmd.get("dialogue")
            if not dialogue:
                continue
            lines.append(
                {
                    "speaker": cmd.get("character") or "",
                    "text": dialogue.get("text") or "",
                    "align": dialogue.get("align") or "left",
                }
            )

        characters = self._characters(scene, lines)
        background = self.mirror.background_url(((scene.get("setup") or {}).get("background")) or "")

        exercises = []
        for task in item["tasks"]:
            ex = self._build_exercise(task)
            if ex:
                exercises.append(ex)

        return {
            "key": self._lesson_key(ch),
            "defaults": {
                "slug": ch["dashedName"],
                "title": ch["title"],
                "description": strip_html(detail.get("description") if detail else ""),
                "order": item["lesson_order"],
                "characters": characters,
                "lines": lines,
                "background": background,
                "exercises": exercises,
            },
        }

    def _build_exercise(self, ch):
        detail = self._fetch_detail(ch["fields"]["slug"])
        if not detail:
            return None
        prompt = strip_html(detail.get("description"))

        if detail["challengeType"] == TYPE_FILL_BLANK:
            fitb = detail.get("fillInTheBlank") or {}
            return {
                "kind": "fill_blank",
                "title": ch["title"],
                "prompt": prompt,
                "sentence": strip_html(fitb.get("sentence")),
                "blanks": [
                    {"answer": strip_html(b.get("answer")), "feedback": strip_html(b.get("feedback"))}
                    for b in (fitb.get("blanks") or [])
                ],
            }

        questions = []
        for q in detail.get("questions") or []:
            questions.append(
                {
                    "text": strip_html(q.get("text")),
                    "answers": [strip_html(a.get("answer")) for a in (q.get("answers") or [])],
                }
            )
        return {
            "kind": "choice",
            "title": ch["title"],
            "prompt": prompt,
            "questions": questions,
        }

    @staticmethod
    def _lesson_key(ch):
        """Stable global slug from the source path, e.g. ``<superblock>/<block>/<dashed>``."""
        slug = ((ch.get("fields") or {}).get("slug") or "").strip("/")
        if slug.startswith("learn/"):
            slug = slug[len("learn/") :]
        return slug or ch["dashedName"]

    def _characters(self, scene, lines):
        names = []
        for entry in (scene.get("setup") or {}).get("characters") or []:
            name = entry.get("character")
            if name and name not in names:
                names.append(name)
        for line in lines:
            if line["speaker"] and line["speaker"] not in names:
                names.append(line["speaker"])
        return [{"name": n, "role": "", "images": self.mirror.character_images(n)} for n in names]

    # ── HTTP ──────────────────────────────────────────────────────────────
    def _fetch_listing(self, superblock):
        url = SUPERBLOCK_DATA.format(superblock=superblock)
        data = self._get_json(url)
        if not data:
            return []
        nodes = data.get("result", {}).get("data", {}).get("allChallengeNode", {}).get("nodes", [])
        return [n["challenge"] for n in nodes if n["challenge"].get("superBlock") == superblock]

    def _group_blocks(self, nodes):
        """Ordered ``[(block_slug, [challenges])]`` preserving curriculum order."""
        order = []
        buckets = {}
        for ch in nodes:
            block = ch["block"]
            if block not in buckets:
                buckets[block] = []
                order.append(block)
            buckets[block].append(ch)
        return [(b, buckets[b]) for b in order]

    def _fetch_detail(self, slug):
        data = self._get_json(PAGE_DATA.format(slug=slug.rstrip("/")))
        if not data:
            return None
        node = data.get("result", {}).get("data", {}).get("challengeNode") or {}
        return node.get("challenge")

    def _get_json(self, url):
        try:
            resp = self.session.get(url, timeout=30)
            if resp.status_code != 200:
                self.stderr.write(f"  HTTP {resp.status_code} for {url}")
                return None
            if self.delay:
                time.sleep(self.delay)
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            self.stderr.write(f"  Request failed: {exc}")
            return None
