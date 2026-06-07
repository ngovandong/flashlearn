import base64
import io
import logging

import requests
from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 200_000
DEFAULT_MAX_DIMENSION = 800
JPEG_QUALITIES = (85, 75, 65, 55, 45)


def is_remote_image_url(value: str | None) -> bool:
    return bool(value) and value.startswith(("http://", "https://"))


def bytes_to_data_uri(image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{content_type};base64,{encoded}"


def optimize_image_bytes(
    image_bytes: bytes,
    content_type: str | None = None,
    *,
    max_bytes: int | None = None,
    max_dimension: int | None = None,
) -> tuple[bytes, str]:
    """Resize and re-encode an image until it fits within max_bytes."""
    resolved_max_bytes: int = max_bytes or getattr(settings, "TERM_IMAGE_MAX_BYTES", DEFAULT_MAX_BYTES)
    resolved_max_dimension: int = max_dimension or getattr(settings, "TERM_IMAGE_MAX_DIMENSION", DEFAULT_MAX_DIMENSION)
    resolved_content_type = (content_type or "image/jpeg").split(";")[0].strip()

    if len(image_bytes) <= resolved_max_bytes:
        return image_bytes, resolved_content_type

    opened = Image.open(io.BytesIO(image_bytes))
    opened.load()
    img: Image.Image = opened
    try:
        transposed = ImageOps.exif_transpose(img)
        if transposed is not None:
            img = transposed
    except Exception:
        pass

    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)

    def resize(image: Image.Image, dimension: int) -> Image.Image:
        if max(image.size) <= dimension:
            return image
        resized = image.copy()
        resized.thumbnail((dimension, dimension), Image.Resampling.LANCZOS)
        return resized

    def to_rgb(image: Image.Image) -> Image.Image:
        if image.mode == "RGB":
            return image
        if has_alpha:
            background = Image.new("RGB", image.size, (255, 255, 255))
            rgba = image.convert("RGBA")
            background.paste(rgba, mask=rgba.split()[-1])
            return background
        return image.convert("RGB")

    dimension = resolved_max_dimension
    while dimension >= 200:
        working = resize(img, dimension)
        if has_alpha:
            buf = io.BytesIO()
            working.save(buf, format="PNG", optimize=True)
            if buf.tell() <= resolved_max_bytes:
                return buf.getvalue(), "image/png"

        rgb = to_rgb(working)
        for quality in JPEG_QUALITIES:
            buf = io.BytesIO()
            rgb.save(buf, format="JPEG", quality=quality, optimize=True)
            if buf.tell() <= resolved_max_bytes:
                return buf.getvalue(), "image/jpeg"

        dimension = int(dimension * 0.75)

    buf = io.BytesIO()
    to_rgb(resize(img, 200)).save(buf, format="JPEG", quality=40, optimize=True)
    logger.warning("Image still exceeds %d bytes after compression; saved smallest JPEG", resolved_max_bytes)
    return buf.getvalue(), "image/jpeg"


def url_to_base64(
    image_url: str,
    *,
    max_bytes: int | None = None,
    max_dimension: int | None = None,
) -> str:
    response = requests.get(image_url, timeout=15)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "image/jpeg")
    image_bytes = response.content
    optimized_bytes, final_type = optimize_image_bytes(
        image_bytes,
        content_type,
        max_bytes=max_bytes,
        max_dimension=max_dimension,
    )
    return bytes_to_data_uri(optimized_bytes, final_type)
