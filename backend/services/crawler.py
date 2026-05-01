import re
from abc import ABC, abstractmethod
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

SEARCH_PHOTO_URL_BING = "https://www.bing.com/images/search"
IMAGE_CSS_SELECTOR_BING = "div.imgpt a.iusc img"
SEARCH_PHOTO_URL_GOOGLE = "https://www.google.com/search"
IMAGE_CSS_SELECTOR_GOOGLE = "h3 img"
IMG_URL_REGEX_BING = r"https://tse\d.mm.bing.net/"
IMG_URL_REGEX_GOOLE = r"https://encrypted-tbn0.gstatic.com/images\?q[\w\d\-\u0026=]+"


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
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        image_elements = soup.select(IMAGE_CSS_SELECTOR_BING)
        images = []
        for image in image_elements:
            src = image.attrs.get("src", None)
            if src and re.match(IMG_URL_REGEX_BING, src):
                images.append(src)

        return images[:count]


class GoogleImageSearchStrategy(ImageSearchStrategy):
    def get_preview_images(self, query, count=10):
        params = urlencode({"q": query, "udm": 2, "hl": "en", "source": "hp", "sclient": "img"})
        url = f"{SEARCH_PHOTO_URL_GOOGLE}?{params}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        image_elements = soup.select(IMAGE_CSS_SELECTOR_GOOGLE)

        image_urls = []
        for img in image_elements:
            src = str(img.attrs.get("src", ""))
            if re.match(IMG_URL_REGEX_GOOLE, src):
                image_urls.append(src)

        return image_urls[:count]


class BSCrawler:
    bing_strategy = BingImageSearchStrategy()
    google_strategy = GoogleImageSearchStrategy()

    @classmethod
    def get_preview_images(cls, query, count=10):
        return cls.bing_strategy.get_preview_images(query, count)
