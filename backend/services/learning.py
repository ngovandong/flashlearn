"""Backward-compatible re-exports."""

from backend.learning.application.services import LearningService
from backend.learning.infrastructure.cache import learning_progress_cache

__all__ = ["LearningService", "learning_progress_cache"]
