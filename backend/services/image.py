import base64
import requests


def url_to_base64(image_url):
    response = requests.get(image_url)
    response.raise_for_status()

    image_data = response.content
    base64_data = base64.b64encode(image_data)
    base64_string = base64_data.decode("utf-8")

    image_format = response.headers.get("content-type")
    if image_format:
        base64_string = f"data:{image_format};base64,{base64_string}"
    return base64_string
