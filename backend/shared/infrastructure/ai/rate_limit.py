"""Cross-process serialization + rate limiting for AI provider calls.

The original throttle (``min_interval`` in :class:`RetryingHttpProvider`) lived
in *process memory*, so every web worker, the RQ worker, and the cron backfill
paced themselves independently and together blew Google's free-tier per-minute
quota. This module enforces the limit **globally** through Redis:

- a distributed lock so only ONE provider request is in flight at a time
  (calls run sequentially), and
- a sliding-window limiter so we never exceed N requests per minute.

Callers block in a fair-ish waiting line until both conditions allow them
through, which turns the shared Redis state into a request queue *without*
changing the synchronous request/response flow the API endpoints rely on.

When Redis is unavailable (e.g. ``SKIP_REDIS=1`` or local dev), it degrades to
an in-process lock + sliding window so a single process still behaves.
"""

import logging
import os
import threading
import time
import uuid
from collections import deque
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Sliding-window limiter. Returns 0 when a slot is granted, else the number of
# milliseconds to wait before the oldest request leaves the window.
#   KEYS[1] = sorted-set key
#   ARGV[1] = limit, ARGV[2] = window_ms, ARGV[3] = now_ms, ARGV[4] = member
_RATE_LUA = """
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count < limit then
  redis.call('ZADD', KEYS[1], now, ARGV[4])
  redis.call('PEXPIRE', KEYS[1], window)
  return 0
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local wait = (tonumber(oldest[2]) + window) - now
if wait < 0 then wait = 0 end
return wait
"""

# Release only a lock we still own (compare-and-delete), so a request that
# overran its TTL can't delete a lock another caller has since taken.
_UNLOCK_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
"""

_DEFAULT_RPM = 15
_DEFAULT_WINDOW_MS = 60_000
# Headroom so a lock left by a crashed worker frees within a request lifetime.
_DEFAULT_LOCK_TTL_MS = 180_000
# How long a caller waits in line before giving up and proceeding anyway
# (fail-open: the provider's own retry/backoff still handles a stray 429).
_DEFAULT_MAX_WAIT = 120.0
_POLL_INTERVAL = 0.25


def _env_float(name: str, label: str, default: float) -> float:
    """Read ``AI_GATE_<NAME>_<LABEL>`` then ``AI_GATE_<NAME>`` then ``default``."""
    raw = os.getenv(f"AI_GATE_{name}_{label.upper()}") or os.getenv(f"AI_GATE_{name}")
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Invalid AI_GATE_%s value %r; using %s", name, raw, default)
        return default


def _get_redis():
    """Return a shared Redis client, or ``None`` to fall back to in-process."""
    from django.conf import settings

    if getattr(settings, "SKIP_REDIS", None) == "1":
        return None
    try:
        from django_redis import get_redis_connection

        return get_redis_connection("default")
    except Exception as exc:  # noqa: BLE001 - any failure means "no Redis"
        logger.warning("AI gate: Redis unavailable (%s); using in-process limiter", exc)
        return None


class _InProcessGate:
    """Best-effort fallback: serialize + rate-limit within a single process."""

    def __init__(self, rpm: float, window_ms: int):
        self._lock = threading.Lock()
        self._limit = max(1, int(rpm))
        self._window = window_ms / 1000.0
        self._hits: deque[float] = deque()

    @contextmanager
    def slot(self):
        with self._lock:
            self._wait_for_token()
            self._hits.append(time.monotonic())
            yield

    def _wait_for_token(self) -> None:
        while True:
            now = time.monotonic()
            while self._hits and self._hits[0] <= now - self._window:
                self._hits.popleft()
            if len(self._hits) < self._limit:
                return
            time.sleep(max(0.0, self._hits[0] + self._window - now))


class GlobalAiGate:
    """A per-provider gate enforcing one-at-a-time + RPM across all processes."""

    _scripts_lock = threading.Lock()

    def __init__(
        self,
        name: str,
        *,
        rpm: float | None = None,
        window_ms: int = _DEFAULT_WINDOW_MS,
        lock_ttl_ms: int | None = None,
        max_wait: float | None = None,
        enabled: bool | None = None,
    ):
        self._name = name
        self._rpm = rpm if rpm is not None else _env_float("RPM", name, _DEFAULT_RPM)
        self._window_ms = window_ms
        self._lock_ttl_ms = int(
            lock_ttl_ms if lock_ttl_ms is not None else _env_float("LOCK_TTL_MS", name, _DEFAULT_LOCK_TTL_MS)
        )
        self._max_wait = max_wait if max_wait is not None else _env_float("MAX_WAIT", name, _DEFAULT_MAX_WAIT)
        if enabled is None:
            enabled = os.getenv("AI_GATE_ENABLED", "true").strip().lower() not in ("false", "0", "no")
        self._enabled = enabled

        self._lock_key = f"ai:gate:lock:{name}"
        self._rate_key = f"ai:gate:rpm:{name}"
        self._redis = None
        self._rate_sha = None
        self._unlock_sha = None
        self._fallback = _InProcessGate(self._rpm, self._window_ms)

    def _ensure_scripts(self) -> bool:
        """Load the Lua scripts once; returns False if Redis is unavailable."""
        if self._redis is not None:
            return True
        with self._scripts_lock:
            if self._redis is not None:
                return True
            client = _get_redis()
            if client is None:
                return False
            try:
                self._rate_sha = client.script_load(_RATE_LUA)
                self._unlock_sha = client.script_load(_UNLOCK_LUA)
            except Exception as exc:  # noqa: BLE001
                logger.warning("AI gate: failed to load Lua scripts (%s); using in-process limiter", exc)
                return False
            self._redis = client
            return True

    @contextmanager
    def slot(self):
        """Block until a request slot is available, then yield. Always releases."""
        if not self._enabled or not self._ensure_scripts():
            if self._enabled:
                # Redis missing: still serialize/limit within this process.
                with self._fallback.slot():
                    yield
            else:
                yield
            return

        deadline = time.monotonic() + self._max_wait
        token = self._acquire_lock(deadline)
        try:
            self._await_rate_token(deadline, token)
            yield
        finally:
            if token is not None:
                self._release_lock(token)

    def _acquire_lock(self, deadline: float) -> str | None:
        """Take the single in-flight slot; returns the lock token (None = timed out)."""
        assert self._redis is not None
        token = uuid.uuid4().hex
        while True:
            try:
                if self._redis.set(self._lock_key, token, nx=True, px=self._lock_ttl_ms):
                    return token
            except Exception as exc:  # noqa: BLE001
                logger.warning("AI gate %s: lock error (%s); proceeding without lock", self._name, exc)
                return None
            if time.monotonic() >= deadline:
                logger.warning(
                    "AI gate %s: waited %.0fs for a slot; proceeding anyway",
                    self._name,
                    self._max_wait,
                )
                return None
            time.sleep(_POLL_INTERVAL)

    def _await_rate_token(self, deadline: float, token: str | None) -> None:
        """Consume one RPM token, sleeping (and refreshing the lock) until allowed."""
        assert self._redis is not None
        assert self._rate_sha is not None
        while True:
            now_ms = int(time.time() * 1000)
            try:
                wait_ms = self._redis.evalsha(
                    self._rate_sha,
                    1,
                    self._rate_key,
                    int(self._rpm),
                    self._window_ms,
                    now_ms,
                    uuid.uuid4().hex,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("AI gate %s: rate check error (%s); proceeding", self._name, exc)
                return
            if not wait_ms or int(wait_ms) <= 0:
                return
            if time.monotonic() >= deadline:
                logger.warning("AI gate %s: rate wait exceeded budget; proceeding anyway", self._name)
                return
            sleep_s = min(int(wait_ms) / 1000.0, _POLL_INTERVAL * 4, max(0.0, deadline - time.monotonic()))
            time.sleep(max(sleep_s, _POLL_INTERVAL))
            self._refresh_lock(token)

    def _refresh_lock(self, token: str | None) -> None:
        if token is None:
            return
        assert self._redis is not None
        try:
            self._redis.pexpire(self._lock_key, self._lock_ttl_ms)
        except Exception:  # noqa: BLE001
            pass

    def _release_lock(self, token: str) -> None:
        assert self._redis is not None
        assert self._unlock_sha is not None
        try:
            self._redis.evalsha(self._unlock_sha, 1, self._lock_key, token)
        except Exception:  # noqa: BLE001
            pass
