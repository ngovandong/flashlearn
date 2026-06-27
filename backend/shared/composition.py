"""Composition root — wire concrete infrastructure into application services."""

from backend.course.application.course_service import CourseService
from backend.course.infrastructure.repository import CourseRepository
from backend.deck.application.services import DeckService
from backend.deck.infrastructure.repository import DeckRepository
from backend.learning.application.context_api import LearningContextApi
from backend.learning.application.services import LearningService
from backend.learning.infrastructure.cache import learning_progress_cache
from backend.learning.infrastructure.repository import LearningRepository
from backend.reminders.application.services import ReminderService
from backend.reminders.infrastructure.repository import ReminderRepository
from backend.shared.infrastructure.ai import (
    AzureSpeechProvider,
    build_tts_provider,
    default_ai_provider,
)
from backend.shared.infrastructure.cache import default_cache
from backend.shared.infrastructure.cloudinary import default_audio_storage, default_image_storage
from backend.shared.infrastructure.google_oauth import default_oauth_client
from backend.speaking.application.services import SpeakingCoachService
from backend.speaking.application.speaking_service import SpeakingService
from backend.speaking.infrastructure.repository import SpeakingRepository
from backend.term.application.ai_enrichment import TermEnrichmentService
from backend.term.application.context_api import TermContextApi
from backend.term.application.services import TermService
from backend.term.infrastructure.repository import TermRepository
from backend.user.application.context_api import UserContextApi
from backend.user.application.services import AuthService, UserService
from backend.user.infrastructure.repository import UserRepository
from backend.writing.application.services import WritingCoachService
from backend.writing.application.writing_service import WritingService
from backend.writing.infrastructure.repository import WritingRepository

term_context = TermContextApi(TermRepository)
user_context = UserContextApi(UserRepository, default_cache)

learning_service = LearningService(
    learning_repo=LearningRepository,
    term_context=term_context,
    user_context=user_context,
    learning_cache=learning_progress_cache,
)
learning_context = LearningContextApi(learning_service, learning_progress_cache)

deck_service = DeckService(
    deck_repo=DeckRepository,
    user_context=user_context,
    learning_context=learning_context,
)
term_service = TermService(
    term_repo=TermRepository,
    image_storage=default_image_storage,
    learning_context=learning_context,
)
user_service = UserService(user_repo=UserRepository, cache=default_cache)
auth_service = AuthService(oauth=default_oauth_client)
term_enrichment_service = TermEnrichmentService(ai=default_ai_provider)
# Azure Speech does measured pronunciation scoring (accuracy/fluency/phonemes);
# only wired when credentials are present, otherwise the coach falls back to the
# multimodal listener for analysis.
_azure_speech = AzureSpeechProvider()
speaking_coach_service = SpeakingCoachService(
    ai=default_ai_provider,
    pronunciation=_azure_speech if _azure_speech.is_configured else None,
)
speaking_service = SpeakingService(
    coach=speaking_coach_service,
    repo=SpeakingRepository,
    audio_storage=default_audio_storage,
)
# Course dialogue audio: each character gets a fixed gender-matched voice. The TTS
# provider (azure / elevenlabs / kokoro) is chosen at generation time via the
# injected factory (`generate_course_audio --tts`), so each is built on demand.
course_service = CourseService(
    repo=CourseRepository,
    speaking_service=speaking_service,
    ai=default_ai_provider,
    tts_factory=build_tts_provider,
    image_storage=default_image_storage,
    audio_storage=default_audio_storage,
)
reminder_service = ReminderService(repo=ReminderRepository)
# Writing Coach: chat practice + IELTS-style free-form assessment. Text-only AI,
# so it just needs the default provider (no audio/TTS/pronunciation deps).
writing_coach_service = WritingCoachService(ai=default_ai_provider)
writing_service = WritingService(coach=writing_coach_service, repo=WritingRepository)
