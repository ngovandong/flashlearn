"""Import DailyDictation listen-and-type exercises into our Listening models.

Each exercise's ``/listen-and-type`` page embeds a ``window.appGlobals`` JSON with
the lesson name, full-audio URL and a ``challenges`` array — one per sentence —
carrying the sentence text, its per-sentence audio URL, in-audio timestamps and a
tokenized transcript (``jsonContent``) whose slots list accepted alternatives
(e.g. ``["Where is", "where's"]``). We parse that object directly; no headless
browser needed.

Audio is NOT downloaded here — sentence recordings are mirrored to our own CDN
afterwards by ``collect_listening_audio`` (which also TTS-synthesizes any sentence
without a source recording). Video-only topics (News/TED/YouTube/Stories-for-Kids)
are intentionally omitted — they have no per-sentence MP3s.

Exercises are keyed by a stable natural slug (``{topic}/{slug}``) so user progress
is retained across ``--clean`` + re-crawl.

Usage:
    uv run python manage.py crawl_dictation
    uv run python manage.py crawl_dictation --topics english-conversations --limit 2
    uv run python manage.py crawl_dictation --topics all --clean --workers 8
    # then: uv run python manage.py collect_listening_audio
"""

import html
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from django.core.management.base import BaseCommand
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from backend.services import listening_service

BASE = "https://dailydictation.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FlashLearn-dictation-importer/1.0)"}

# Audio-based DailyDictation topics (video-only topics are intentionally excluded).
TOPICS = {
    "short-stories": {
        "title": "Short Stories",
        "level": "A1-C1",
        "order": 1,
        "description": "Audio articles about culture, people, places and daily life in English-speaking countries.",
    },
    "english-conversations": {
        "title": "Conversations",
        "level": "A1-B1",
        "order": 2,
        "description": "Short, fun everyday English conversations with casual phrases native speakers use.",
    },
    "toeic": {
        "title": "TOEIC Listening",
        "level": "A2-C1",
        "order": 3,
        "description": "Conversations and short talks from everyday life and work to sharpen communication skills.",
    },
    "ielts-listening": {
        "title": "IELTS Listening",
        "level": "B1-C1",
        "order": 4,
        "description": "Everyday and academic recordings, mainly in British and Australian accents.",
    },
    "toefl-listening": {
        "title": "TOEFL Listening",
        "level": "B1-C2",
        "order": 5,
        "description": "Academic conversations and lectures to prepare for study in English-speaking countries.",
    },
    "medical-english-oet": {
        "title": "Medical English (OET)",
        "level": "B1-C2",
        "order": 6,
        "description": "English for healthcare professionals preparing for the Occupational English Test.",
    },
    "english-pronunciation": {
        "title": "IPA",
        "level": "A1",
        "order": 7,
        "description": "Pronunciation exercises building a foundation for listening and speaking.",
    },
    "numbers": {
        "title": "Numbers",
        "level": "A1",
        "order": 8,
        "description": "Train your ear to understand English numbers spoken quickly.",
    },
    "spelling-names": {
        "title": "Spelling Names",
        "level": "A1",
        "order": 9,
        "description": "Learn and practice the English alphabet by spelling common names.",
    },
}
DEFAULT_TOPICS = "short-stories,english-conversations,numbers"

_TAG_RE = re.compile(r"<[^>]+>")
# Exercise slug + numeric id from a listen-and-type href, e.g. "1-at-home-1.399".
_EXERCISE_RE = re.compile(r"/exercises/{slug}/([a-z0-9-]+\.[0-9]+)/listen-and-type")


def make_session(workers: int) -> requests.Session:
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


def strip_html(value):
    if not value:
        return ""
    return html.unescape(_TAG_RE.sub("", value)).strip()


def extract_js_object(text: str, marker: str):
    """Extract a balanced ``{...}`` object literal that follows ``marker`` in ``text``.

    Scans brace depth while respecting double-quoted strings/escapes so the JSON
    embedded in the page's inline script is captured exactly (it contains many
    nested braces that a regex would mishandle).
    """
    start = text.find(marker)
    if start == -1:
        return None
    start = text.find("{", start)
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


class Command(BaseCommand):
    help = "Import DailyDictation listen-and-type exercises into the Listening models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--topics",
            default=DEFAULT_TOPICS,
            help=f"Comma list of topic slugs, or 'all'. Default: {DEFAULT_TOPICS}",
        )
        parser.add_argument("--limit", type=int, default=0, help="Max exercises per topic (0 = all). Use 1-2 to test.")
        parser.add_argument("--workers", type=int, default=6, help="Parallel fetch threads (keep modest).")
        parser.add_argument(
            "--retries",
            type=int,
            default=5,
            help="Per-request retries for 429/5xx/connection errors (exponential backoff).",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete the targeted topics' content before re-crawling (user progress is kept).",
        )
        parser.add_argument("--delay", type=float, default=0.0, help="Seconds to sleep between requests.")

    def handle(self, *args, **opts):
        self.delay = opts["delay"]
        self.limit = opts["limit"]
        self.workers = max(1, opts["workers"])
        self.retries = max(0, opts["retries"])
        self.session = make_session(self.workers)

        raw = opts["topics"].strip().lower()
        slugs = list(TOPICS) if raw == "all" else [s.strip() for s in raw.split(",") if s.strip()]
        valid = [s for s in slugs if s in TOPICS]
        for s in slugs:
            if s not in TOPICS:
                self.stderr.write(f"Unknown topic '{s}' (expected one of {list(TOPICS)})")

        if opts["clean"] and valid:
            listening_service.clean_topics(valid)
            self.stdout.write(self.style.WARNING(f"Cleaned existing content for: {', '.join(valid)}"))

        for slug in valid:
            self.import_topic(slug)

    def import_topic(self, slug):
        cfg = TOPICS[slug]
        self.stdout.write(self.style.MIGRATE_HEADING(f"Importing {cfg['title']}…"))
        urls = self._list_exercises(slug)
        if not urls:
            self.stderr.write(f"  No exercises found for {slug}.")
            return
        if self.limit:
            urls = urls[: self.limit]

        topic = listening_service.import_topic(
            slug=slug,
            defaults={
                "title": cfg["title"],
                "level": cfg["level"],
                "description": cfg.get("description", ""),
                "source": "dailydictation",
                "order": cfg["order"],
            },
        )

        # Network-bound page fetches + parsing in parallel; DB writes are sequential.
        built = [None] * len(urls)
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {pool.submit(self._build_exercise, slug, ref, i): i for i, ref in enumerate(urls)}
            for future in as_completed(futures):
                i = futures[future]
                try:
                    built[i] = future.result()
                except Exception as exc:  # noqa: BLE001 — keep going on a single bad exercise
                    self.stderr.write(f"  build failed for {urls[i]}: {exc}")

        # Final safety net: any exercise still missing (e.g. throttled past its
        # retry budget while every worker hammered the server) is retried once
        # more, sequentially and unhurried, so the whole batch isn't left short.
        missing = [i for i, data in enumerate(built) if data is None]
        if missing:
            self.stdout.write(f"  Retrying {len(missing)} failed exercise(s) sequentially…")
            for i in missing:
                time.sleep(1.0)
                try:
                    built[i] = self._build_exercise(slug, urls[i], i)
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(f"  retry failed for {urls[i]}: {exc}")

        saved = 0
        for data in built:
            if data is None:
                continue
            listening_service.import_exercise(key=data["key"], defaults={**data["defaults"], "topic": topic})
            saved += 1
        failed = len(urls) - saved
        summary = f"  Done: {saved}/{len(urls)} exercises."
        if failed:
            self.stdout.write(self.style.WARNING(f"{summary} {failed} still failed — re-run to fill them in."))
        else:
            self.stdout.write(self.style.SUCCESS(summary))

    def _list_exercises(self, slug):
        """Ordered, de-duplicated ``{slug}.{id}`` references for a topic (single page)."""
        text = self._get(f"{BASE}/exercises/{slug}")
        if not text:
            return []
        pattern = re.compile(_EXERCISE_RE.pattern.format(slug=re.escape(slug)))
        seen = set()
        refs = []
        for match in pattern.finditer(text):
            ref = match.group(1)
            if ref not in seen:
                seen.add(ref)
                refs.append(ref)
        return refs

    def _build_exercise(self, topic_slug, ref, order):
        """Parse one exercise's ``window.appGlobals`` into an upsert payload."""
        text = self._get(f"{BASE}/exercises/{topic_slug}/{ref}/listen-and-type")
        if not text:
            return None
        raw = extract_js_object(text, "window.appGlobals")
        if not raw:
            self.stderr.write(f"  no appGlobals for {ref}")
            return None
        data = json.loads(raw)

        sentences = []
        for ch in data.get("challenges") or []:
            content = (ch.get("content") or "").strip()
            if not content:
                continue
            sentences.append(
                {
                    "position": ch.get("position"),
                    "text": content,
                    # Tokenized transcript; slots may be a string or a list of accepted
                    # alternatives (contractions). Drives the reveal + client evaluation.
                    "tokens": ch.get("jsonContent") or ch.get("solution") or [],
                    "source_audio_url": (ch.get("audioSrc") or "").strip(),
                    "audio_url": "",
                    "audio_hosted": False,
                    "time_start": ch.get("timeStart"),
                    "time_end": ch.get("timeEnd"),
                    "hint": ch.get("hint"),
                    "explanation": strip_html(ch.get("explanation")) or None,
                }
            )
        if not sentences:
            return None

        exercise_slug = ref.replace(".", "-")  # SlugField disallows dots
        return {
            "key": f"{topic_slug}/{exercise_slug}",
            "defaults": {
                "slug": exercise_slug,
                "title": (data.get("lessonName") or ref).strip(),
                "level": TOPICS[topic_slug]["level"],
                "order": order,
                "source_id": str(data.get("lessonId") or ""),
                "full_audio_url": (data.get("audioSrc") or "").strip(),
                "sentences": sentences,
            },
        }

    def _get(self, url):
        """Fetch a page, retrying rate-limits (429) and transient errors.

        DailyDictation rate-limits bursty concurrent crawls with 429s; we back off
        exponentially (honoring any ``Retry-After`` header) so a throttled request
        recovers on its own instead of leaving an exercise blank.
        """
        delay = 1.5
        for attempt in range(self.retries + 1):
            try:
                resp = self.session.get(url, timeout=30)
            except requests.RequestException as exc:
                if attempt >= self.retries:
                    self.stderr.write(f"  Request failed after {self.retries} retries: {url} ({exc})")
                    return None
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue

            if resp.status_code == 200:
                if self.delay:
                    time.sleep(self.delay)
                return resp.text

            transient = resp.status_code == 429 or resp.status_code >= 500
            if transient and attempt < self.retries:
                wait = self._retry_after(resp, delay)
                self.stderr.write(f"  HTTP {resp.status_code} for {url} — retrying in {wait:.0f}s")
                time.sleep(wait)
                delay = min(delay * 2, 60)
                continue

            self.stderr.write(f"  HTTP {resp.status_code} for {url}")
            return None
        return None

    @staticmethod
    def _retry_after(resp, fallback):
        """Seconds to wait before retrying: the server's ``Retry-After`` if sane, else ``fallback``."""
        header = resp.headers.get("Retry-After")
        if header:
            try:
                return min(max(float(header), fallback), 60)
            except ValueError:
                pass
        return fallback
