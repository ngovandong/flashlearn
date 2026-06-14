import os
import unittest

from django.test import SimpleTestCase

from backend.services.crawler import BSCrawler, GoogleImageSearchStrategy


class GoogleImageParserTest(SimpleTestCase):
    def test_enablejs_on_large_page_is_not_blocked(self):
        html = "enablejs" + ("x" * 120_000)
        self.assertFalse(GoogleImageSearchStrategy._is_blocked(html))

    def test_trouble_page_is_blocked(self):
        html = "If you're having trouble accessing Google Search"
        self.assertTrue(GoogleImageSearchStrategy._is_blocked(html))

    def test_parse_embedded_image_urls(self):
        html = """
        <script>
        AF_initDataCallback({key:"ds:1",data:["https://example.com/morning-coffee.jpg",1200,800]});
        "ou":"https://cdn.example.com/coffee-cup.png","ru":"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ";
        </script>
        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTest">
        """

        urls = GoogleImageSearchStrategy._parse_images(html, 10)

        self.assertIn("https://cdn.example.com/coffee-cup.png", urls)
        self.assertIn("https://example.com/morning-coffee.jpg", urls)
        self.assertTrue(any("encrypted-tbn0.gstatic.com" in url for url in urls))


@unittest.skipUnless(
    os.getenv("CRAWLER_INTEGRATION") == "1",
    "Live crawler benchmark skipped. Set CRAWLER_INTEGRATION=1 to run.",
)
class CrawlerStrategyBenchmarkTest(SimpleTestCase):
    """Live network benchmark for all image providers.

    Requires Playwright Chromium for Google:
        uv run playwright install chromium

    Run:
        CRAWLER_INTEGRATION=1 uv run python manage.py test backend.tests.test_crawler.CrawlerStrategyBenchmarkTest -v 2
    """

    def test_benchmark_all_strategies(self):
        query = os.getenv("CRAWLER_BENCHMARK_QUERY", "morning coffee")
        count = int(os.getenv("CRAWLER_BENCHMARK_COUNT", "5"))

        report = BSCrawler.benchmark_strategies(query, count)
        print("\n" + BSCrawler.format_benchmark_report(report))

        working_providers = [name for name, entry in report["providers"].items() if entry["count"] > 0]
        self.assertGreater(
            report["providers"]["google"]["count"],
            0,
            "Google should return URLs (requires: uv run playwright install chromium)",
        )
        self.assertGreaterEqual(
            len(working_providers),
            4,
            f"Expected all 4 providers to return images, got: {working_providers}",
        )
        self.assertGreaterEqual(
            report["combined"]["count"],
            1,
            "Combined crawler should return at least one image URL",
        )

        for name in ("google", "bing", "openverse", "wikimedia"):
            self.assertIn(name, report["providers"])
            self.assertIn("elapsed_ms", report["providers"][name])
