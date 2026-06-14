import cloudinary.uploader

from backend.services.image import url_to_base64


class CloudinaryImageStorage:
    def upload_bytes(self, data: bytes) -> str:
        result = cloudinary.uploader.upload(data)
        return result.get("url", "")

    def upload_file(self, file_obj) -> str:
        result = cloudinary.uploader.upload(file_obj)
        return result.get("url", "")

    def url_to_base64(self, url: str) -> str:
        return url_to_base64(url)


default_image_storage = CloudinaryImageStorage()
