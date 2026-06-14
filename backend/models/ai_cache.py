import hashlib
import json

from django.db import models

from base.models import DateTimeUUIDModel


class AiResponseCache(DateTimeUUIDModel):
    """Persistent cache of AI provider responses keyed by ``(context, request_hash)``.

    Idempotent AI calls — term enrichment, phrase explanation and conversation
    generation — produce the same result for the same inputs, yet each call is
    billed by the provider. This table lets an identical request be served from
    the DB instead of hitting the model again (e.g. re-opening a previously
    noted word in the Speaking Coach no longer re-enriches it).

    ``response`` stores the already-normalized JSON the caller hands back to the
    frontend, so reads need no post-processing. Bump :attr:`VERSION` whenever the
    prompts/schemas change so stale entries are naturally ignored.
    """

    # Bump to invalidate every cached entry after a prompt/schema change.
    VERSION = "v1"

    context = models.CharField(max_length=32, db_index=True)
    request_hash = models.CharField(max_length=64, db_index=True)
    response = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["context", "request_hash"], name="uniq_ai_cache_ctx_hash"),
        ]

    @classmethod
    def make_hash(cls, context: str, parts) -> str:
        """Stable sha256 of the request inputs (order-sensitive)."""
        payload = json.dumps(
            [cls.VERSION, context, *[("" if p is None else p) for p in parts]],
            ensure_ascii=False,
            default=str,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def remember(cls, context: str, parts, producer):
        """Return the cached response for ``(context, parts)`` or compute & store it.

        ``producer`` is a zero-arg callable that performs the real AI call and
        returns a JSON-serializable dict. Any exception it raises (e.g.
        ``AiProviderError``) propagates and nothing is cached.
        """
        request_hash = cls.make_hash(context, parts)
        row = cls.objects.filter(context=context, request_hash=request_hash).first()
        if row is not None:
            return row.response
        result = producer()
        cls.objects.get_or_create(
            context=context,
            request_hash=request_hash,
            defaults={"response": result},
        )
        return result
