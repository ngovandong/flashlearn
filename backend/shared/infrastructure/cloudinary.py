import base64
import io

import cloudinary.uploader

from backend.services.image import url_to_base64


class CloudinaryImageStorage:
    def upload_bytes(self, data: bytes) -> str:
        result = cloudinary.uploader.upload(data)
        return result.get("secure_url") or result.get("url", "")

    def upload_file(self, file_obj) -> str:
        result = cloudinary.uploader.upload(file_obj)
        return result.get("secure_url") or result.get("url", "")

    def upload_svg(self, svg_markup: str, public_id: str) -> str:
        """Upload raw SVG markup to Cloudinary at a deterministic ``public_id``.

        ``overwrite=True`` so re-running the seeder refreshes the same asset rather
        than orphaning copies. Returns the hosted URL.
        """
        data_uri = "data:image/svg+xml;base64," + base64.b64encode(svg_markup.encode("utf-8")).decode("ascii")
        result = cloudinary.uploader.upload(data_uri, public_id=public_id, overwrite=True, resource_type="image")
        return result.get("secure_url") or result.get("url", "")

    def mirror_url(self, source_url: str, public_id: str) -> str:
        """Fetch ``source_url`` into Cloudinary at a deterministic ``public_id``.

        Idempotent: ``overwrite=False`` means a re-run returns the existing asset
        without re-fetching, so re-crawls are cheap. Returns the Cloudinary URL.
        """
        result = cloudinary.uploader.upload(source_url, public_id=public_id, overwrite=False, resource_type="image")
        return result.get("secure_url") or result.get("url", "")

    def url_to_base64(self, url: str) -> str:
        return url_to_base64(url)


default_image_storage = CloudinaryImageStorage()


class CloudinaryAudioStorage:
    """Stores TTS audio bytes on Cloudinary so they don't bloat the database.

    Uploads with ``resource_type="raw"`` so the exact bytes (MP3 or raw 16-bit
    PCM) are served back unchanged — the frontend fetches the URL and decodes it
    with the Web Audio API using the clip's ``mime_type``.
    """

    def upload_audio(self, data: bytes, *, public_id: str | None = None) -> str:
        # A deterministic public_id + overwrite keeps re-runs idempotent (a
        # re-synthesized clip replaces its asset instead of orphaning copies).
        options = {"resource_type": "raw", "overwrite": True}
        if public_id:
            options["public_id"] = public_id
        result = cloudinary.uploader.upload(io.BytesIO(data), **options)
        return result.get("secure_url") or result.get("url", "")


default_audio_storage = CloudinaryAudioStorage()
