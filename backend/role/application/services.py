from backend.role.infrastructure.repository import RoleRepository
from backend.shared.application.exceptions import ValidationError
from backend.token import JWTToken


class RoleService:
    @staticmethod
    def accept_invite(token, user):
        if token is None:
            raise ValidationError("token is required")
        try:
            t = JWTToken(token)
            payload = t.get_payload()
            deck_id = payload["deck_id"]
            role = payload["role"]
            deck = RoleRepository.get_deck(deck_id)
            if not deck:
                raise ValidationError("deck not found")
            if not RoleRepository.user_in_deck(deck, user):
                RoleRepository.add_user_to_deck(deck, user, role)
            return deck_id
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError("Invalid token") from exc
