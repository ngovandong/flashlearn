import io

from django.test import SimpleTestCase, override_settings
from PIL import Image

from backend.services.image import bytes_to_data_uri, is_remote_image_url, optimize_image_bytes


def _make_jpeg_bytes(width: int, height: int, quality: int = 95) -> bytes:
    img = Image.new("RGB", (width, height), color=(120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


class ImageServiceTest(SimpleTestCase):
    def test_is_remote_image_url(self):
        self.assertTrue(is_remote_image_url("https://example.com/a.png"))
        self.assertTrue(is_remote_image_url("http://example.com/a.png"))
        self.assertFalse(is_remote_image_url("data:image/png;base64,abc"))
        self.assertFalse(is_remote_image_url(""))

    @override_settings(TERM_IMAGE_MAX_BYTES=10_000, TERM_IMAGE_MAX_DIMENSION=400)
    def test_optimize_large_image_reduces_size(self):
        original = _make_jpeg_bytes(2000, 1500)
        optimized, content_type = optimize_image_bytes(original, "image/jpeg")

        self.assertLess(len(optimized), len(original))
        self.assertLessEqual(len(optimized), 10_000)
        self.assertEqual(content_type, "image/jpeg")

    def test_bytes_to_data_uri(self):
        uri = bytes_to_data_uri(b"abc", "image/jpeg")
        self.assertEqual(uri, "data:image/jpeg;base64,YWJj")
