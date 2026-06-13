import re
from typing import Any

from django.core.files.uploadedfile import InMemoryUploadedFile

from backend.deck.domain.access import DeckAccessPolicy
from backend.shared.application.dtos import ReviseTermRow
from backend.shared.application.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from backend.shared.infrastructure.cloudinary import default_image_storage
from backend.term.infrastructure.repository import TermRepository


class TermService:
    def __init__(
        self,
        term_repo: type[TermRepository] | TermRepository = TermRepository,
        image_storage: Any = default_image_storage,
        learning_context: Any = None,
    ):
        self._term_repo = term_repo
        self._image_storage = image_storage
        self._learning_context = learning_context

    def _validate_name(self, name):
        if not name or not str(name).strip():
            raise ValidationError("name may not be blank")
        if len(str(name)) > 255:
            raise ValidationError("name may not exceed 255 characters")

    def get_terms_from_deck_id(self, deck_id: int):
        return self._term_repo.filter_by_deck(deck_id)

    def get_learning_terms_for_deck(self, deck_id, user):
        return self._term_repo.get_terms_for_deck(deck_id, user)

    def normalize_image(self, image, image_storage=None):
        storage = image_storage or self._image_storage
        if image and isinstance(image, str) and image.startswith("https:"):
            try:
                return storage.url_to_base64(image)
            except Exception:
                return image
        return image

    def upload_image_if_needed(self, image, image_storage=None):
        storage = image_storage or self._image_storage
        if isinstance(image, InMemoryUploadedFile):
            image_bytes = image.read()
            return storage.upload_bytes(image_bytes)
        return image

    def create_term(self, deck, user, data, image_storage=None):
        if not deck:
            raise NotFoundError("deck not found")
        if not DeckAccessPolicy.can_edit(deck, user):
            raise PermissionDeniedError("user has no permission.")
        name = data.get("name")
        self._validate_name(name)
        deck_id = data.get("deck", deck.id)
        image = data.get("image")
        if image:
            data = {**data, "image": self.upload_image_if_needed(image, image_storage)}
        normalized_image = self.normalize_image(data.get("image"), image_storage)
        return self._term_repo.create(
            deck_id,
            name=name,
            description=data.get("description", ""),
            image=normalized_image or "",
        )

    def add_to_default_deck(self, user, data, image_storage=None):
        default_deck_id = user.default_deck_id
        if not default_deck_id:
            raise ValidationError("Please setup your default deck")
        data = {**data, "deck": default_deck_id}
        name = data.get("name")
        self._validate_name(name)
        if self._term_repo.find_by_name_in_deck(default_deck_id, name):
            raise ConflictError("term is already existed")
        return self.create_term(user.default_deck, user, data, image_storage)

    def add_terms(self, deck, user, terms_data):
        if not deck:
            raise NotFoundError("deck not found")
        if not DeckAccessPolicy.can_edit(deck, user):
            raise PermissionDeniedError("user has no permission.")
        for term in terms_data:
            self._validate_name(term.get("name"))
        self._term_repo.bulk_create(deck.id, terms_data)

    def bulk_update_terms(self, terms_data):
        for item in terms_data:
            if not item.get("id"):
                raise ValidationError("term id is required")
            self._validate_name(item.get("name"))
            self._term_repo.update_term(
                item["id"],
                item["name"],
                item.get("description", ""),
                item.get("image", ""),
            )

    def parse_multipart_terms(self, formdata, image_storage=None):
        storage = image_storage or self._image_storage
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
                parsed_data[term_index]["image"] = self.upload_image_if_needed(value, storage)
        return parsed_data

    def parse_add_terms_payload(self, data, image_storage=None):
        storage = image_storage or self._image_storage
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
                    parsed_dict["terms"][term_index]["image"] = self.upload_image_if_needed(value, storage)
        return parsed_dict

    def get_revise_terms(self, user, deck_id):
        all_terms = [ReviseTermRow.from_mapping(t).to_dict() for t in self._term_repo.get_random_terms(deck_id)]
        revise_terms = [
            ReviseTermRow.from_mapping(t).to_dict() for t in self._term_repo.get_revise_terms(user, deck_id)
        ]
        deck_name = self._term_repo.get_deck_name(deck_id)
        if deck_name is None:
            raise NotFoundError("deck not found")
        return {
            "deck_name": deck_name,
            "all_terms": all_terms,
            "revise_terms": revise_terms,
        }

    def invalidate_learning_cache(self, deck_id, user_id):
        if self._learning_context is None:
            raise RuntimeError("learning_context is not configured")
        self._learning_context.invalidate_progress_cache(deck_id, user_id)
