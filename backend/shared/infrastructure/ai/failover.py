"""Failover across multiple AI providers.

Tries each provider in order; if one fails (rate limit, unavailable, network
error) it falls over to the next. A failing provider is put on a short cooldown
so subsequent requests skip it instead of repeatedly paying its retry/backoff
cost — important when the primary is rate-limited for a sustained window.
"""

import logging
import os
import time

from .base import AiProviderError

logger = logging.getLogger(__name__)

_DEFAULT_COOLDOWN = 120.0


class FailoverAiProvider:
    def __init__(self, providers, cooldown: float | None = None):
        self._providers = list(providers)
        self._cooldown = (
            cooldown if cooldown is not None else float(os.getenv("AI_PROVIDER_COOLDOWN", str(_DEFAULT_COOLDOWN)))
        )
        self._unavailable_until: dict[int, float] = {}

    @property
    def is_configured(self) -> bool:
        return any(getattr(p, "is_configured", True) for p in self._providers)

    def generate_json(self, system, user, schema=None, audio=None):
        configured = [p for p in self._providers if getattr(p, "is_configured", True)]
        if not configured:
            raise AiProviderError("No AI provider is configured")

        now = time.monotonic()
        ready = [p for p in configured if self._unavailable_until.get(id(p), 0.0) <= now]
        if not ready:
            # Every provider failed recently. Don't pay each one's retry/backoff
            # again — fail fast so the caller can skip ahead and retry later.
            soonest = min(self._unavailable_until[id(p)] for p in configured)
            raise AiProviderError(
                f"All AI providers are cooling down after recent failures; retry in ~{max(0, int(soonest - now))}s"
            )

        last_error: AiProviderError | None = None
        for provider in ready:
            try:
                result = provider.generate_json(system, user, schema, audio)
                self._unavailable_until.pop(id(provider), None)
                return result
            except AiProviderError as exc:
                last_error = exc
                self._unavailable_until[id(provider)] = time.monotonic() + self._cooldown
                logger.warning(
                    "AI provider %s failed (%s); failing over to next provider",
                    getattr(provider, "label", type(provider).__name__),
                    exc,
                )
                continue

        raise last_error or AiProviderError("All AI providers failed")
