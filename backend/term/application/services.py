import re

from django.core.files.uploadedfile import InMemoryUploadedFile

from backend.shared.application.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from backend.shared.infrastructure.cloudinary import default_image_storage
from backend.term.infrastructure.repository import TermRepository


class TermService:
    @staticmethod
    def _validate_name(name):
        if not name or not str(name).strip():
            raise ValidationError("name may not be blank")
        if len(str(name)) > 255:
            raise ValidationError("name may not exceed 255 characters")

    @staticmethod
    def get_terms_from_deck_id(deck_id: int):
        return TermRepository.filter_by_deck(deck_id)

    @staticmethod
    def normalize_image(image, image_storage=None):
        storage = image_storage or default_image_storage
        if image and isinstance(image, str) and image.startswith("https:"):
            try:
                return storage.url_to_base64(image)
            except Exception:
                return image
        return image

    @staticmethod
    def upload_image_if_needed(image, image_storage=None):
        storage = image_storage or default_image_storage
        if isinstance(image, InMemoryUploadedFile):
            image_bytes = image.read()
            return storage.upload_bytes(image_bytes)
        return image

    @staticmethod
    def create_term(deck, user, data, image_storage=None):
        if not deck:
            raise NotFoundError("deck not found")
        if not deck.user_can_edit_deck(user):
            raise PermissionDeniedError("user has no permission.")
        name = data.get("name")
        TermService._validate_name(name)
        deck_id = data.get("deck", deck.id)
        image = data.get("image")
        if image:
            data = {**data, "image": TermService.upload_image_if_needed(image, image_storage)}
        normalized_image = TermService.normalize_image(data.get("image"), image_storage)
        return TermRepository.create(
            deck_id,
            name=name,
            description=data.get("description", ""),
            image=normalized_image or "",
        )

    @staticmethod
    def add_to_default_deck(user, data, image_storage=None):
        default_deck_id = user.default_deck_id
        if not default_deck_id:
            raise ValidationError("Please setup your default deck")
        data = {**data, "deck": default_deck_id}
        name = data.get("name")
        TermService._validate_name(name)
        if TermRepository.find_by_name_in_deck(default_deck_id, name):
            raise ConflictError("term is already existed")
        return TermService.create_term(user.default_deck, user, data, image_storage)

    @staticmethod
    def add_terms(deck, user, terms_data):
        if not deck:
            raise NotFoundError("deck not found")
        if not deck.user_can_edit_deck(user):
            raise PermissionDeniedError("user has no permission.")
        for term in terms_data:
            TermService._validate_name(term.get("name"))
        TermRepository.bulk_create(deck.id, terms_data)

    @staticmethod
    def bulk_update_terms(terms_data):
        for item in terms_data:
            if not item.get("id"):
                raise ValidationError("term id is required")
            TermService._validate_name(item.get("name"))
            TermRepository.update_term(
                item["id"],
                item["name"],
                item.get("description", ""),
                item.get("image", ""),
            )

    @staticmethod
    def parse_multipart_terms(formdata, image_storage=None):
        storage = image_storage or default_image_storage
        parsed_data = []
        for key, value in formdata.items():
            term_index = int(re.findall(r"\d+", key)[0])
            term_property = key.split("[")[2].split("]")[0]
            if len(parsed_data) < term_index + 1:
                parsed_data.append({})
            if term_property == "id":
                parsed_data[term_index]["id"] = value
            elif term_property == "name":
                parsed_data[term_index]["name"] = value
            elif term_property == "description":
                parsed_data[term_index]["description"] = value
            elif term_property == "image":
                parsed_data[term_index]["image"] = TermService.upload_image_if_needed(value, storage)
        return parsed_data

    @staticmethod
    def parse_add_terms_payload(data, image_storage=None):
        storage = image_storage or default_image_storage
        parsed_dict = {"deck_id": data.get("deck_id", ""), "terms": []}
        for key, value in data.items():
            if key.startswith("terms"):
                term_index = int(key.split("[")[1].split("]")[0])
                term_property = key.split("[")[2].split("]")[0]
                if len(parsed_dict["terms"]) < term_index + 1:
                    parsed_dict["terms"].append({})
                if term_property == "name":
                    parsed_dict["terms"][term_index]["name"] = value
                elif term_property == "description":
                    parsed_dict["terms"][term_index]["description"] = value
                elif term_property == "image":
                    parsed_dict["terms"][term_index]["image"] = TermService.upload_image_if_needed(value, storage)
        return parsed_dict

    @staticmethod
    def get_revise_terms(user, deck_id):
        all_terms = TermRepository.get_random_terms(deck_id)
        revise_terms = TermRepository.get_revise_terms(user, deck_id)
        deck_name = TermRepository.get_deck_name(deck_id)
        if deck_name is None:
            raise NotFoundError("deck not found")
        return {
            "deck_name": deck_name,
            "all_terms": all_terms,
            "revise_terms": revise_terms,
        }

    @staticmethod
    def invalidate_learning_cache(deck_id, user_id):
        from backend.learning.infrastructure.cache import learning_progress_cache

        learning_progress_cache.delete_combine(deck_id, user_id)
