import json
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, wait
from urllib.parse import quote, unquote, urlencode

import requests
from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
}
GOOGLE_BROWSER_HEADERS = {
    **DEFAULT_HEADERS,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}
API_USER_AGENT = "FlashLearn/1.0"
REQUEST_TIMEOUT = 12
PROVIDER_TIMEOUT = 25
GOOGLE_IMPERSONATE = "chrome131"
GOOGLE_PLAYWRIGHT_TIMEOUT_MS = 25000


class ImageSearchStrategy(ABC):
    name = "unknown"

    @abstractmethod
    def get_preview_images(self, query, count=10):
        pass

    def _get(self, url, *, headers=None, params=None):
        response = requests.get(
            url,
            params=params,
            headers=headers or DEFAULT_HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response


class BingImageSearchStrategy(ImageSearchStrategy):
    name = "bing"

    def get_preview_images(self, query, count=10):
        params = urlencode({"q": query, "form": "HDRSC2", "first": 1, "count": max(count, 35)})
        response = self._get(f"https://www.bing.com/images/search?{params}")
        soup = BeautifulSoup(response.text, "html.parser")

        images = []
        for element in soup.select("a.iusc"):
            metadata = element.get("m")
            if not metadata or not isinstance(metadata, str):
                continue
            try:
                data = json.loads(metadata)
            except json.JSONDecodeError:
                continue

            image_url = data.get("murl") or data.get("turl")
            if image_url and image_url.startswith("http"):
                images.append(image_url)
            if len(images) >= count:
                break

        return images[:count]


class GoogleImageSearchStrategy(ImageSearchStrategy):
    name = "google"

    _BLOCKED_MARKERS = (
        "trouble accessing google search",
        "enablejs",
        "sg_trbl",
        "unusual traffic from your computer network",
    )
    _SEARCH_PARAMS = (
        {"q": None, "udm": "2", "hl": "en", "gl": "us"},
        {"q": None, "tbm": "isch", "hl": "en", "ijn": "0", "start": "0"},
    )

    def get_preview_images(self, query, count=10):
        html = self._fetch_search_html(query)
        if html:
            images = self._parse_images(html, count)
            if images:
                return images

        if os.getenv("CRAWLER_GOOGLE_SKIP_PLAYWRIGHT") == "1":
            logger.info("Google Playwright fallback disabled for query=%r", query)
            return []

        return self._fetch_with_playwright(query, count)

    def _fetch_with_playwright(self, query, count):
        try:
            from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.warning("Playwright is not installed; cannot fall back for Google image search")
            return []

        html = ""
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled"],
                )
                context = browser.new_context(
                    user_agent=DEFAULT_USER_AGENT,
                    locale="en-US",
                    viewport={"width": 1366, "height": 900},
                )
                page = context.new_page()
                page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
                page.goto(
                    f"https://www.google.com/search?q={quote(query)}&udm=2&hl=en&gl=us",
                    wait_until="domcontentloaded",
                    timeout=GOOGLE_PLAYWRIGHT_TIMEOUT_MS,
                )
                page.wait_for_timeout(1200)
                page.mouse.wheel(0, 1200)
                page.wait_for_timeout(600)
                html = page.content()
                browser.close()
        except PlaywrightTimeoutError:
            logger.warning("Google Playwright search timed out for query=%r", query)
            return []
        except Exception:
            logger.warning("Google Playwright search failed for query=%r", query, exc_info=True)
            return []

        return self._parse_images(html, count)

    def _fetch_search_html(self, query):
        session = curl_requests.Session(impersonate=GOOGLE_IMPERSONATE)
        session.get(
            "https://www.google.com/",
            headers=GOOGLE_BROWSER_HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        session.get(
            "https://www.google.com/webhp",
            params={"hl": "en", "gl": "us"},
            headers={**GOOGLE_BROWSER_HEADERS, "Referer": "https://www.google.com/"},
            timeout=REQUEST_TIMEOUT,
        )

        for params in self._SEARCH_PARAMS:
            request_params = {**params, "q": query}
            response = session.get(
                "https://www.google.com/search",
                params=request_params,
                headers={**GOOGLE_BROWSER_HEADERS, "Referer": "https://www.google.com/webhp?hl=en&gl=us"},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            if not self._is_blocked(response.text):
                return response.text

        logger.info("Google HTTP search blocked for query=%r; trying Playwright", query)
        return None

    @classmethod
    def _is_blocked(cls, html):
        text = html.lower()
        if "trouble accessing google search" in text:
            return True
        if "sg_trbl" in text:
            return True
        if "unusual traffic from your computer network" in text:
            return True
        # Bare enablejs also appears on fully rendered image results; only block tiny JS-gate pages.
        if "enablejs" in text and len(html) < 100_000:
            return True
        return False

    @classmethod
    def _is_valid_image_url(cls, url):
        if not url.startswith("http"):
            return False
        lower = url.lower()
        blocked_fragments = (
            "google.com/images/branding",
            "google.com/logos",
            "gstatic.com/images/branding",
            "/favicon",
            "accounts.google.com",
        )
        return not any(fragment in lower for fragment in blocked_fragments)

    @classmethod
    def _parse_images(cls, html, count):
        images = []
        seen = set()

        def add(url):
            url = cls._normalize_url(url)
            if not url or url in seen or not cls._is_valid_image_url(url):
                return
            seen.add(url)
            images.append(url)

        for pattern in (
            r'"ou":"(https?://[^"\\]+)"',
            r'"ru":"(https?://[^"\\]+)"',
            r'\["(https?://[^"\\]+)",\s*\d+,\s*\d+\]',
            r"(https://encrypted-tbn0\.gstatic\.com/images\?[^\"'\\]+)",
            r"http[^\[\]'\"\\]*?\.(?:jpg|jpeg|png|webp|gif|bmp)",
        ):
            for match in re.finditer(pattern, html, re.IGNORECASE):
                add(match.group(1) if match.lastindex else match.group(0))
                if len(images) >= count:
                    return images[:count]

        soup = BeautifulSoup(html, "html.parser")
        for img in soup.select("h3 img, div[data-ri] img, img[src]"):
            src = str(img.get("src", ""))
            if src.startswith("http"):
                add(src)
            if len(images) >= count:
                break

        return images[:count]

    @staticmethod
    def _normalize_url(url):
        if not url:
            return ""
        if "\\u" in url:
            url = bytes(url, "utf-8").decode("unicode-escape")
        return unquote(url).strip()


class OpenverseImageSearchStrategy(ImageSearchStrategy):
    name = "openverse"

    def get_preview_images(self, query, count=10):
        response = self._get(
            "https://api.openverse.org/v1/images/",
            headers={"User-Agent": API_USER_AGENT},
            params={"q": query, "page_size": min(count, 20)},
        )
        return [item["url"] for item in response.json().get("results", []) if item.get("url")][:count]


class WikimediaImageSearchStrategy(ImageSearchStrategy):
    name = "wikimedia"

    def get_preview_images(self, query, count=10):
        response = self._get(
            "https://commons.wikimedia.org/w/api.php",
            headers={"User-Agent": API_USER_AGENT},
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": 6,
                "gsrlimit": min(count, 20),
                "prop": "imageinfo",
                "iiprop": "url|thumburl",
                "iiurlwidth": 400,
                "format": "json",
            },
        )
        pages = response.json().get("query", {}).get("pages", {})
        images = []
        for page in pages.values():
            info = page.get("imageinfo", [{}])[0]
            url = info.get("thumburl") or info.get("url")
            if url:
                images.append(url)
        return images[:count]


class BSCrawler:
    _BATCH_SIZE = 2
    _PROVIDER_PRIORITY = ("google", "bing", "openverse", "wikimedia")
    strategies = (
        GoogleImageSearchStrategy(),
        BingImageSearchStrategy(),
        OpenverseImageSearchStrategy(),
        WikimediaImageSearchStrategy(),
    )
    _strategy_batches = (
        (GoogleImageSearchStrategy(), BingImageSearchStrategy()),
        (OpenverseImageSearchStrategy(), WikimediaImageSearchStrategy()),
    )

    @classmethod
    def get_preview_images(cls, query, count=10):
        query = str(query).strip()
        if not query:
            return []

        count = max(1, min(int(count), 50))
        per_provider = max(count, 15)
        results_by_provider = cls._fetch_from_providers(query, per_provider, count)
        return cls._merge_results(results_by_provider, count)

    @classmethod
    def _fetch_from_providers(cls, query, per_provider, count):
        results_by_provider = {strategy.name: [] for strategy in cls.strategies}

        for batch in cls._strategy_batches:
            batch_results = cls._fetch_batch(batch, query, per_provider)
            results_by_provider.update(batch_results)

            if len(cls._merge_results(results_by_provider, count)) >= count:
                break

        return results_by_provider

    @classmethod
    def _fetch_batch(cls, strategies, query, per_provider):
        results = {}

        with ThreadPoolExecutor(max_workers=cls._BATCH_SIZE) as executor:
            futures = {
                executor.submit(strategy.get_preview_images, query, per_provider): strategy for strategy in strategies
            }
            done, _ = wait(futures.keys(), timeout=PROVIDER_TIMEOUT)
            for future in done:
                strategy = futures[future]
                try:
                    results[strategy.name] = future.result()
                except Exception:
                    logger.warning(
                        "Image provider %s failed for query=%r",
                        strategy.name,
                        query,
                        exc_info=True,
                    )
                    results[strategy.name] = []

        return results

    @classmethod
    def _merge_results(cls, results_by_provider, count):
        merged = []
        seen = set()
        queues = {name: list(results_by_provider.get(name, [])) for name in cls._PROVIDER_PRIORITY}

        while len(merged) < count and any(queues.values()):
            for name in cls._PROVIDER_PRIORITY:
                while queues[name]:
                    url = queues[name].pop(0)
                    if url in seen:
                        continue
                    seen.add(url)
                    merged.append(url)
                    break
                if len(merged) >= count:
                    break

        return merged[:count]

    @classmethod
    def benchmark_strategies(cls, query, count=5):
        """Run each provider sequentially and measure latency + URLs for verification."""
        query = str(query).strip()
        count = max(1, min(int(count), 50))
        report = {"query": query, "requested_count": count, "providers": {}}

        for strategy in cls.strategies:
            started = time.perf_counter()
            entry = {
                "status": "empty",
                "count": 0,
                "elapsed_ms": 0,
                "urls": [],
                "error": None,
            }
            try:
                urls = strategy.get_preview_images(query, count)
                entry["urls"] = urls
                entry["count"] = len(urls)
                entry["status"] = "ok" if urls else "empty"
            except Exception as exc:
                entry["status"] = "fail"
                entry["error"] = str(exc)
            entry["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 1)
            report["providers"][strategy.name] = entry

        started = time.perf_counter()
        merged = cls.get_preview_images(query, count)
        report["combined"] = {
            "status": "ok" if merged else "empty",
            "count": len(merged),
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "urls": merged,
        }
        return report

    @staticmethod
    def format_benchmark_report(report):
        """Human-readable report grouped by provider for manual image verification."""
        lines = [
            f"Image crawler benchmark — query: {report['query']!r} (count={report['requested_count']})",
            "=" * 80,
        ]

        for name in ("google", "bing", "openverse", "wikimedia"):
            entry = report["providers"].get(name)
            if not entry:
                continue
            lines.append(
                f"\n[{name.upper()}] {entry['status'].upper()} | {entry['elapsed_ms']} ms | {entry['count']} url(s)"
            )
            if entry.get("error"):
                lines.append(f"  error: {entry['error']}")
            if not entry["urls"]:
                lines.append("  (no results)")
            for index, url in enumerate(entry["urls"], start=1):
                lines.append(f"  {index}. {url}")

        combined = report["combined"]
        lines.extend(
            [
                "\n" + "-" * 80,
                f"[COMBINED / BSCrawler] {combined['status'].upper()} | "
                f"{combined['elapsed_ms']} ms | {combined['count']} url(s)",
            ]
        )
        if not combined["urls"]:
            lines.append("  (no results)")
        for index, url in enumerate(combined["urls"], start=1):
            lines.append(f"  {index}. {url}")

        working = sum(1 for entry in report["providers"].values() if entry["count"] > 0)
        total_ms = sum(entry["elapsed_ms"] for entry in report["providers"].values())
        lines.extend(
            [
                "\n" + "=" * 80,
                f"Summary: {working}/4 providers returned images | sequential total: {total_ms} ms",
            ]
        )
        return "\n".join(lines)
