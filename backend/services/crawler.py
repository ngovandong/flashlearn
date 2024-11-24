import requests
from urllib.parse import urlencode
from bs4 import BeautifulSoup
import re
import json
from abc import ABC, abstractmethod


SEARCH_PHOTO_URL_BING = "https://www.bing.com/images/search"
IMAGE_CSS_SELECTOR_BING = "div.imgpt a.iusc img"
SEARCH_PHOTO_URL_GOOGLE = "https://www.google.com.vn/search"
IMAGE_CSS_SELECTOR_GOOGLE = "[data-lpage] h3 img[id*='dimg_']"


class ImageSearchStrategy(ABC):
    @abstractmethod
    def get_preview_images(self, query, count=10):
        pass


class BingImageSearchStrategy(ImageSearchStrategy):
    def get_preview_images(self, query, count=10):
        params = urlencode({"q": query})
        url = f"{SEARCH_PHOTO_URL_BING}?{params}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        image_elements = soup.select(IMAGE_CSS_SELECTOR_BING)
        images = []
        for image in image_elements:
            src = image.attrs.get("data-src", None)
            if src and src.startswith("https://tse3.mm.bing.net/th/id"):
                images.append(src)

        return images[:count]


class GoogleImageSearchStrategy(ImageSearchStrategy):
    def get_preview_images(self, query, count=10):
        params = urlencode({"q": query, "udm": 2})
        url = f"{SEARCH_PHOTO_URL_GOOGLE}?{params}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        script_tags = soup.find_all("script")
        image_urls = []
        url_pattern = r"https://encrypted-tbn0.gstatic.com/images\?q[\w\d\-\u0026=]+"

        for script in script_tags:
            if script.string and "google.ldi" in script.string:
                try:
                    json_data = re.search(
                        r"google\.ldi\s*=\s*({.*?});", script.string
                    ).group(1)
                    json_data = json_data.replace("\\u003d", "=").replace(
                        "\\u0026", "&"
                    )
                    json_data = json.loads(json_data)

                    for key, value in json_data.items():
                        if re.match(url_pattern, value):
                            image_urls.append(value)

                except (json.JSONDecodeError, AttributeError):
                    continue

        return image_urls[:count]


class BSCrawler:
    bing_strategy = BingImageSearchStrategy()
    google_strategy = GoogleImageSearchStrategy()

    @classmethod
    def get_preview_images(cls, query, count=10):
        return cls.google_strategy.get_preview_images(query, count)
