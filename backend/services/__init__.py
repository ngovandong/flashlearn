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
    course_service,
    deck_service,
    learning_context,
    learning_service,
    reminder_service,
    speaking_coach_service,
    speaking_service,
    term_enrichment_service,
    term_service,
    user_service,
    writing_coach_service,
    writing_service,
)
from backend.speaking.application.services import SpeakingCoachService
from backend.speaking.application.speaking_service import SpeakingService
from backend.term.application.ai_enrichment import TermEnrichmentService
from backend.term.application.services import TermService
from backend.user.application.services import AuthService, UserService
from backend.writing.application.services import WritingCoachService
from backend.writing.application.writing_service import WritingService

__all__ = [
    "AuthService",
    "DeckService",
    "FolderService",
    "LearningService",
    "MailService",
    "RoleService",
    "SpeakingCoachService",
    "SpeakingService",
    "TermEnrichmentService",
    "TermService",
    "UserService",
    "WritingCoachService",
    "WritingService",
    "auth_service",
    "course_service",
    "deck_service",
    "learning_context",
    "learning_service",
    "learning_progress_cache",
    "reminder_service",
    "speaking_coach_service",
    "speaking_service",
    "term_enrichment_service",
    "term_service",
    "url_to_base64",
    "user_service",
    "writing_coach_service",
    "writing_service",
]
