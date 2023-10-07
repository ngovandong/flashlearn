import base64
from urllib.parse import  urlencode

import requests
from bs4 import BeautifulSoup


TRANSLATE_URL = "https://translate.google.com/"
SEARCH_PHOTO_URL = "https://www.google.com/search"
# CHROME_DRIVER_PATH = "chromedriver/chromedriver"
TRANSLATED_XPATH_LOCATOR = "//*[@jsname='W297wb']"
IMAGES_XPATH_LOCATOR_1 = "//*[@jsname='sTFXNd']"
IMAGES_XPATH_LOCATOR_2 = "//*[@jsname='sTFXNd' and @href]"
# IMAGE_CONTAINER_CSS_SELECTOR = "div[data-tbnid]"
# IMAGE_CSS_SELECTOR = "a img"
IMAGE_CSS_SELECTOR = "div[data-tbnid] a img"
HIGH_IMAGES_XPATH_LOCATOR = "(//*[@jsname='JuXqh' ])[2]"


class BSCrawler:
    @staticmethod
    def get_preview_images(query, count=5):
        # Format the search query for the Google Images URL
        params = urlencode({'q': query, "tbm": "isch"})
        url = f'{SEARCH_PHOTO_URL}?{params}'

        # Send an HTTP GET request to the Google Images page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.5'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        # Parse the HTML response
        soup = BeautifulSoup(response.text, 'html.parser')

        image_elements = soup.select(IMAGE_CSS_SELECTOR)
        images = []
        for image in image_elements:
            src = image.attrs.get("data-src", None)
            if src and src.startswith("https://encrypted-tbn0.gstatic.com/images?"):
                images.append(src)

        return images[:count]

    @staticmethod
    def url_to_base64(image_url):
        # Send an HTTP GET request to the image URL
        response = requests.get(image_url)
        response.raise_for_status()

        # Read the image data
        image_data = response.content

        # Convert the image data to base64
        base64_data = base64.b64encode(image_data)

        # Decode the base64 data to a string
        base64_string = base64_data.decode('utf-8')

        # Add the base64 prefix based on the image format
        image_format = response.headers.get('content-type')
        if image_format:
            base64_string = f"data:{image_format};base64,{base64_string}"
        print(base64_string)
        return base64_string
