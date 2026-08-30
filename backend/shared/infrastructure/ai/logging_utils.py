"""Logging and Sentry tracing utilities for AI infrastructure calls."""

import contextvars
import datetime
import logging
from typing import Any

import sentry_sdk

logger = logging.getLogger("backend.ai")

# ContextVar so services or HTTP views can specify what domain feature triggered the AI call
_ai_feature_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("ai_feature", default=None)


class ai_feature_scope:
    """Context manager to tag AI calls with a feature/domain name (e.g. 'term_enrichment')."""

    def __init__(self, feature_name: str):
        self.feature_name = feature_name
        self._token = None

    def __enter__(self):
        self._token = _ai_feature_var.set(self.feature_name)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._token is not None:
            _ai_feature_var.reset(self._token)


def set_ai_feature(feature_name: str | None) -> None:
    """Set the current AI feature name for the active thread/task context."""
    _ai_feature_var.set(feature_name)


def get_ai_feature() -> str | None:
    """Get the active AI feature name."""
    return _ai_feature_var.get()


def estimate_cost_usd(
    provider: str,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    input_chars: int,
    output_chars: int,
) -> float:
    """Estimate the USD cost of an AI call based on provider pricing tiers."""
    p_lower = provider.lower()
    m_lower = model.lower()

    # Free tier or local models
    if any(k in m_lower or k in p_lower for k in ("free", "lmstudio", "kokoro", "local")):
        return 0.0

    prompt_t = prompt_tokens or (input_chars // 4 if input_chars else 0)
    completion_t = completion_tokens or (output_chars // 4 if output_chars else 0)

    # ElevenLabs TTS pricing (~$0.30 per 1,000 characters)
    if "elevenlabs" in p_lower:
        return round((input_chars / 1000.0) * 0.03, 6)

    # Gemini Flash / Lite pricing (~$0.075 / 1M in, $0.30 / 1M out)
    if "gemini" in p_lower or "gemini" in m_lower:
        cost_in = (prompt_t / 1_000_000.0) * 0.075
        cost_out = (completion_t / 1_000_000.0) * 0.30
        return round(cost_in + cost_out, 6)

    # Azure OpenAI / GPT-4o-mini (~$0.15 / 1M in, $0.60 / 1M out)
    if "mini" in m_lower or "gpt-4o-mini" in m_lower:
        cost_in = (prompt_t / 1_000_000.0) * 0.15
        cost_out = (completion_t / 1_000_000.0) * 0.60
        return round(cost_in + cost_out, 6)

    # GPT-4o (~$2.50 / 1M in, $10.00 / 1M out)
    if "gpt-4" in m_lower or "azure" in p_lower:
        cost_in = (prompt_t / 1_000_000.0) * 2.50
        cost_out = (completion_t / 1_000_000.0) * 10.00
        return round(cost_in + cost_out, 6)

    return 0.0


def determine_request_type(provider: str) -> str:
    """Determine the request type category (text_generation | tts | speech_assessment)."""
    p_lower = provider.lower()
    if any(k in p_lower for k in ("tts", "elevenlabs", "kokoro")):
        return "tts"
    if any(k in p_lower for k in ("speech", "pronunciation", "stt")):
        return "speech_assessment"
    return "text_generation"


def extract_prompt_from_payload(payload: dict[str, Any] | None) -> str:
    """Extract a human-readable prompt string from provider JSON payloads."""
    if not isinstance(payload, dict):
        return str(payload) if payload is not None else ""

    # 1. TTS / Text input
    if "text" in payload and isinstance(payload["text"], str):
        return payload["text"]

    # 2. OpenAI / OpenRouter / Azure / LMStudio messages array
    if "messages" in payload and isinstance(payload["messages"], list):
        parts = []
        for msg in payload["messages"]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if isinstance(content, str) and content:
                    parts.append(f"[{role}]: {content}")
        if parts:
            return "\n".join(parts)

    # 3. Gemini contents + systemInstruction
    parts = []
    sys_inst = payload.get("systemInstruction")
    if isinstance(sys_inst, dict):
        for p in sys_inst.get("parts", []):
            if isinstance(p, dict) and "text" in p:
                parts.append(f"[system]: {p['text']}")

    contents = payload.get("contents")
    if isinstance(contents, list):
        for c in contents:
            if isinstance(c, dict):
                role = c.get("role", "user")
                for p in c.get("parts", []):
                    if isinstance(p, dict) and "text" in p:
                        parts.append(f"[{role}]: {p['text']}")

    if parts:
        return "\n".join(parts)

    return str(payload)[:1000]


def extract_response_meta(response_json: dict[str, Any] | None) -> tuple[str, int | None, int | None]:
    """Extract (output_text, prompt_tokens, completion_tokens) from response JSON."""
    if not isinstance(response_json, dict):
        return "", None, None

    output_text = ""
    prompt_tokens = None
    completion_tokens = None

    # Gemini usage & candidates
    if "usageMetadata" in response_json and isinstance(response_json["usageMetadata"], dict):
        meta = response_json["usageMetadata"]
        prompt_tokens = meta.get("promptTokenCount")
        completion_tokens = meta.get("candidatesTokenCount")

    if "candidates" in response_json and isinstance(response_json["candidates"], list):
        try:
            output_text = response_json["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            pass

    # OpenAI-style usage & choices
    if "usage" in response_json and isinstance(response_json["usage"], dict):
        usage = response_json["usage"]
        if prompt_tokens is None:
            prompt_tokens = usage.get("prompt_tokens")
        if completion_tokens is None:
            completion_tokens = usage.get("completion_tokens")

    if not output_text and "choices" in response_json and isinstance(response_json["choices"], list):
        try:
            choice = response_json["choices"][0]
            msg = choice.get("message", {})
            if isinstance(msg, dict):
                output_text = msg.get("content", "")
        except (KeyError, IndexError, TypeError):
            pass

    return output_text, prompt_tokens, completion_tokens


def log_ai_call(
    *,
    provider: str,
    model: str,
    input_text: str,
    output_text: str,
    duration_s: float,
    status_code: int,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    attempt: int = 1,
    request_type: str | None = None,
    error: str | None = None,
) -> None:
    """Record Sentry span attributes + structured logger log for an AI call."""
    now_utc = datetime.datetime.now(datetime.UTC).isoformat()
    input_chars = len(input_text or "")
    output_chars = len(output_text or "")

    # Estimate token counts if API didn't report them
    if prompt_tokens is None and input_chars > 0:
        prompt_tokens = max(1, input_chars // 4)
    if completion_tokens is None and output_chars > 0:
        completion_tokens = max(1, output_chars // 4)

    total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)
    req_type = request_type or determine_request_type(provider)
    is_retry = attempt > 1
    feature = get_ai_feature() or "general"

    # Attempt to pull current user ID from Sentry scope
    user_id = None
    try:
        scope = sentry_sdk.get_current_scope()
        if scope and scope.user:
            user_id = scope.user.get("id") or scope.user.get("email")
    except Exception:
        pass

    cost_usd = estimate_cost_usd(provider, model, prompt_tokens, completion_tokens, input_chars, output_chars)

    op_type = f"ai.{req_type}"
    description = f"{provider} ({model})"

    # 1. Record Sentry span
    with sentry_sdk.start_span(op=op_type, description=description) as span:
        span.set_tag("ai.provider", provider)
        span.set_tag("ai.model_id", model)
        span.set_tag("ai.request_type", req_type)
        span.set_tag("ai.feature", feature)
        span.set_tag("ai.is_retry", str(is_retry))

        span.set_data("ai.provider", provider)
        span.set_data("ai.model_id", model)
        span.set_data("ai.request_type", req_type)
        span.set_data("ai.feature", feature)
        span.set_data("ai.attempt", attempt)
        span.set_data("ai.is_retry", is_retry)
        span.set_data("ai.estimated_cost_usd", cost_usd)
        if user_id:
            span.set_data("ai.user_id", user_id)

        span.set_data("ai.prompt", (input_text or "")[:2000])
        span.set_data("input_chars", input_chars)
        span.set_data("ai.input_tokens", prompt_tokens)
        span.set_data("ai.responses", [(output_text or "")[:2000]])
        span.set_data("output_chars", output_chars)
        span.set_data("ai.output_tokens", completion_tokens)
        span.set_data("ai.total_tokens", total_tokens)
        span.set_data("response_time_s", round(duration_s, 3))
        span.set_data("http.status_code", status_code)
        if error:
            span.set_data("error", error)

    # 2. Add Sentry Breadcrumb (visible in Sentry timeline view)
    try:
        sentry_sdk.add_breadcrumb(
            category="ai.call",
            message=f"{provider} ({model}) [{req_type}]",
            level="info" if status_code == 200 else "warning",
            data={
                "feature": feature,
                "input_prompt": (input_text or "")[:1000],
                "output_response": (output_text or error or "")[:1000],
                "tokens": f"{prompt_tokens or 0} in / {completion_tokens or 0} out",
                "cost_usd": cost_usd,
                "duration_s": round(duration_s, 3),
            },
        )
    except Exception:
        pass

    # 3. Flat logging extra dictionary (avoid 'log' in key names to prevent Sentry PII filter)
    flat_extra = {
        "request_type": req_type,
        "ai_provider": provider,
        "ai_model": model,
        "ai_feature": feature,
        "attempt": attempt,
        "is_retry": is_retry,
        "prompt": (input_text or "")[:1000],
        "response": (output_text or error or "")[:1000],
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "duration_s": round(duration_s, 3),
        "estimated_cost_usd": cost_usd,
    }

    if status_code == 200:
        logger.info(
            "AI Call Succeeded: [%s] %s (%s) — %d in %.2fs | Tokens: %d in / %d out | Est: $%f",
            req_type,
            provider,
            model,
            status_code,
            duration_s,
            prompt_tokens or 0,
            completion_tokens or 0,
            cost_usd,
            extra=flat_extra,
        )
    else:
        logger.warning(
            "AI Call Failed/Warning: [%s] %s (%s) — %d in %.2fs (Attempt %d) | Error: %s",
            req_type,
            provider,
            model,
            status_code,
            duration_s,
            attempt,
            error or "Unknown error",
            extra=flat_extra,
        )
