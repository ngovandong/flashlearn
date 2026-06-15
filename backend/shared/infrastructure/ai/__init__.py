"""AI provider factory.

The active provider is selected with ``AI_PROVIDER`` and optional backups with
``AI_FALLBACK_PROVIDERS`` (comma-separated). When more than one provider is
configured they are wrapped in a :class:`FailoverAiProvider`, so a request that
fails on the primary (rate limit, outage, ...) automatically retries on the
next. Add a provider by creating a sibling module and registering it in
``_BUILDERS``.
"""

import os

from .base import AiProviderError
from .elevenlabs import ElevenLabsProvider
from .failover import FailoverAiProvider
from .gemini import GeminiProvider
from .openrouter import OpenRouterProvider

__all__ = [
    "AiProviderError",
    "GeminiProvider",
    "OpenRouterProvider",
    "ElevenLabsProvider",
    "FailoverAiProvider",
    "get_ai_provider",
    "build_named_provider",
    "default_ai_provider",
]

_BUILDERS = {
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "elevenlabs": ElevenLabsProvider,
}


def _build(name: str, **kwargs):
    try:
        return _BUILDERS[name](**kwargs)
    except KeyError:
        raise ValueError(f"Unknown AI provider: {name!r}")


def _provider_chain(primary: str | None) -> list[str]:
    primary = (primary or os.getenv("AI_PROVIDER", "gemini")).strip().lower()
    fallbacks = os.getenv("AI_FALLBACK_PROVIDERS", "openrouter")
    names = [primary] + [n.strip().lower() for n in fallbacks.split(",") if n.strip()]
    ordered: list[str] = []
    for name in names:
        if name and name not in ordered:
            ordered.append(name)
    return ordered


def build_named_provider(spec: str, model: str | None = None):
    """Build a provider from an explicit ``spec`` (no env-driven fallbacks).

    ``spec`` is one provider name or a comma-separated chain (e.g. ``"openrouter"``
    or ``"openrouter,gemini"``). A single name returns that provider directly so
    callers can bypass a rate-limited primary; multiple names form a failover
    chain. ``model`` overrides the model only when a single provider is given.
    """
    names: list[str] = []
    for n in spec.split(","):
        n = n.strip().lower()
        if n and n not in names:
            names.append(n)
    if not names:
        raise ValueError("No AI provider specified")
    if len(names) == 1:
        return _build(names[0], **({"model": model} if model else {}))
    return FailoverAiProvider([_build(n) for n in names])


def get_ai_provider(name: str | None = None):
    names = _provider_chain(name)

    built = [(n, _build(n)) for n in names]
    configured = [(n, p) for n, p in built if getattr(p, "is_configured", True)]

    if not configured:
        # Nothing has credentials; return the primary so it raises a clear error.
        return built[0][1]
    if len(configured) == 1:
        return configured[0][1]

    # Multiple providers available: primaries fail fast (few retries) so we hand
    # off to a backup quickly instead of burning the full retry budget; the last
    # provider keeps its normal retry budget as the final line of defense.
    fast_retries = int(os.getenv("AI_PRIMARY_MAX_RETRIES", "1"))
    chain = []
    for i, (n, p) in enumerate(configured):
        if i < len(configured) - 1:
            chain.append(_build(n, max_retries=fast_retries))
        else:
            chain.append(p)
    return FailoverAiProvider(chain)


default_ai_provider = get_ai_provider()
