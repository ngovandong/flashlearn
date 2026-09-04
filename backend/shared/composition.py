"""Composition root — wire concrete infrastructure into application services."""

from django.conf import settings

from backend.assistant.application.services import AssistantService
from backend.competition.application.services import CompetitionService
from backend.competition.infrastructure.repository import CompetitionRepository
from backend.course.application.course_service import CourseService
from backend.course.infrastructure.repository import CourseRepository
from backend.deck.application.services import DeckService
from backend.deck.infrastructure.repository import DeckRepository
from backend.grammar.application.grammar_service import GrammarService
from backend.grammar.application.ingest import GrammarIngestService
from backend.grammar.application.services import GrammarCoachService
from backend.grammar.infrastructure.pdf import extract_pages as extract_pdf_pages
from backend.grammar.infrastructure.repository import GrammarRepository
from backend.learning.application.context_api import LearningContextApi
from backend.learning.application.services import LearningService
from backend.learning.infrastructure.cache import learning_progress_cache
from backend.learning.infrastructure.repository import LearningRepository
from backend.listening.application.listening_service import ListeningService
from backend.listening.infrastructure.repository import ListeningRepository
from backend.note.application.note_service import NoteService
from backend.note.infrastructure.repository import NoteRepository
from backend.reminders.application.services import ReminderService
from backend.reminders.infrastructure.repository import ReminderRepository
from backend.revise.application.services import ReviseService
from backend.revise.infrastructure.repository import ReviseRepository
from backend.shared.infrastructure.ai import (
    AzureSpeechProvider,
    build_tts_provider,
    default_ai_provider,
)
from backend.shared.infrastructure.cache import default_cache
from backend.shared.infrastructure.cloudinary import default_audio_storage, default_image_storage
from backend.shared.infrastructure.google_oauth import default_oauth_client
from backend.shared.infrastructure.translate import default_translator
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
# Listening (dictation): cloned listen-and-type exercises. Sentence audio is
# mirrored to our CDN by collect_listening_audio; the Speaking Coach TTS pipeline
# is the fallback when a sentence has no source recording.
listening_service = ListeningService(
    repo=ListeningRepository,
    speaking_service=speaking_service,
    audio_storage=default_audio_storage,
    image_storage=default_image_storage,
    # Per-sentence translation: free Google endpoint first, AI provider as backup.
    translator=default_translator,
    ai=default_ai_provider,
)
reminder_service = ReminderService(repo=ReminderRepository)
# Study notes: one rich-text document per lesson/exercise/session, shared by
# every feature. Self-contained — it only needs its own repository because a
# note is addressed by target type + key, never by joining to the target row.
note_service = NoteService(
    repo=NoteRepository,
    image_storage=default_image_storage,
    image_url_prefixes=(settings.BASE_CLOUDINARY_URL,),
)
# Revise: a mixed, priority-ordered review session that pulls the learner's
# past mistakes across vocab, grammar, listening and speaking. It writes vocab
# results back through the learning service and grades spoken answers with the
# Speaking Coach's pronunciation analysis.
revise_service = ReviseService(
    repo=ReviseRepository,
    learning_service=learning_service,
    speaking_service=speaking_service,
)
# Writing Coach: chat practice + IELTS-style free-form assessment. Text-only AI,
# so it just needs the default provider (no audio/TTS/pronunciation deps).
writing_coach_service = WritingCoachService(ai=default_ai_provider)
writing_service = WritingService(coach=writing_coach_service, repo=WritingRepository)
# Grammar (Essential Grammar in Use): textbook units with server-graded exercises
# and per-unit/per-exercise progress. The coach adds the text-only AI "explain"
# option (explain a rule / why an answer is wrong).
grammar_service = GrammarService(repo=GrammarRepository)
grammar_coach_service = GrammarCoachService(ai=default_ai_provider)
# PDF → structured book ingestion for `import_grammar_book`: extracts page text
# (pypdf) and uses the coach's text AI to convert it into units, then upserts.
grammar_ingest_service = GrammarIngestService(
    coach=grammar_coach_service,
    grammar_service=grammar_service,
    extract_pages=extract_pdf_pages,
)
# Dragon assistant: the general English-learning chat behind the floating buddy.
# Stateless (client sends history) and text-only, so it just needs the default
# AI provider — no repository, no persistence.
assistant_service = AssistantService(ai=default_ai_provider)
# Competition mini-games: serves a term pool for building games client-side and
# persists per-deck leaderboard scores. Pure fun — never touches spaced
# repetition, so it only needs the deck view guard.
competition_service = CompetitionService(
    repo=CompetitionRepository,
    deck_service=deck_service,
)
