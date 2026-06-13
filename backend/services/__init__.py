"""Service layer entry point — prefer composition singletons for new code."""

from backend.deck.application.services import DeckService
from backend.folder.application.services import FolderService
from backend.learning.application.services import LearningService
from backend.learning.infrastructure.cache import learning_progress_cache
from backend.role.application.services import RoleService
from backend.services.image import url_to_base64
from backend.services.mail import MailService
from backend.shared.composition import (
    auth_service,
    deck_service,
    learning_context,
    learning_service,
    term_service,
    user_service,
)
from backend.term.application.services import TermService
from backend.user.application.services import AuthService, UserService

__all__ = [
    "AuthService",
    "DeckService",
    "FolderService",
    "LearningService",
    "MailService",
    "RoleService",
    "TermService",
    "UserService",
    "auth_service",
    "deck_service",
    "learning_context",
    "learning_service",
    "learning_progress_cache",
    "term_service",
    "url_to_base64",
    "user_service",
]
