import base64

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
