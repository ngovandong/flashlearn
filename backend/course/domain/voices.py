"""Character voice assignment for course dialogues.

Each dialogue character is given a stable voice that matches their gender, so the
generated audio sounds consistent across every lesson. Voices are handed out
round-robin within a gender pool, so distinct characters of the same gender still
sound different from one another.

Voice ids are **provider-specific**: Azure neural voice names
(``en-US-JennyNeural``), ElevenLabs voice ids, or Kokoro voice names
(``af_heart``). The active TTS provider is chosen at generation time
(``generate_course_audio --tts``), so the assigned voice must come from that
provider's pool.
"""

# ── Azure en-US neural voices (used verbatim as the Azure TTS voice id) ──────
AZURE_FEMALE_VOICES = [
    "en-US-JennyNeural",
    "en-US-AriaNeural",
    "en-US-MichelleNeural",
    "en-US-SaraNeural",
    "en-US-NancyNeural",
    "en-US-AmberNeural",
    "en-US-AshleyNeural",
    "en-US-ElizabethNeural",
    "en-US-JaneNeural",
    "en-US-MonicaNeural",
]
AZURE_MALE_VOICES = [
    "en-US-GuyNeural",
    "en-US-DavisNeural",
    "en-US-TonyNeural",
    "en-US-JasonNeural",
    "en-US-BrandonNeural",
    "en-US-ChristopherNeural",
    "en-US-EricNeural",
    "en-US-RogerNeural",
    "en-US-SteffanNeural",
    "en-US-AndrewNeural",
]

# ── Kokoro-82M voices (American English; first letter encodes accent+gender) ──
KOKORO_FEMALE_VOICES = [
    "af_heart",
    "af_bella",
    "af_nicole",
    "af_sarah",
    "af_aoede",
    "af_kore",
    "af_nova",
    "af_sky",
]
KOKORO_MALE_VOICES = [
    "am_michael",
    "am_fenrir",
    "am_puck",
    "am_adam",
    "am_echo",
    "am_eric",
    "am_liam",
    "am_onyx",
]

# ── ElevenLabs "Default" voice ids (free-tier accessible) ────────────────────
# Library/community voices (Rachel, Adam, …) now require a paid plan on the API
# (HTTP 402 paid_plan_required), so we use ElevenLabs' curated Default voices,
# which free-tier keys can synthesize. American-English first (best for an
# English-learning app), with a couple of British voices for variety. If your
# account has no Default voices (created after Mar 2026), copy ids from
# `GET /v1/voices` / "My Voices" instead.
ELEVENLABS_FEMALE_VOICES = [
    "9BWtsMINqrJLrRacOk9x",  # Aria (American)
    "EXAVITQu4vr4xnSDxMaL",  # Sarah (American)
    "XrExE9yKIg1WjnnlVkGX",  # Matilda (American)
    "cgSgspJ2msm6clMCkdW9",  # Jessica (American)
    "FGY2WhTYpPnrIDTdsKH5",  # Laura (American)
    "pFZP5JQG7iQjIQuC4Bku",  # Lily (British)
]
ELEVENLABS_MALE_VOICES = [
    "nPczCjzI2devNBz1zQrb",  # Brian (American)
    "cjVigY5qzO86Huf0OWal",  # Eric (American)
    "iP95p4xoKVk53GoZ742B",  # Chris (American)
    "TX3LPaxmHKxFdv7VOQHJ",  # Liam (American)
    "bIHbv24MWmeRgasZH58o",  # Will (American)
    "JBFqnCBsd6RMkjVDRZzb",  # George (British)
]

# {provider: {"female": [...], "male": [...]}}
VOICE_POOLS = {
    "azure": {"female": AZURE_FEMALE_VOICES, "male": AZURE_MALE_VOICES},
    "kokoro": {"female": KOKORO_FEMALE_VOICES, "male": KOKORO_MALE_VOICES},
    "elevenlabs": {"female": ELEVENLABS_FEMALE_VOICES, "male": ELEVENLABS_MALE_VOICES},
}

# Backwards-compatible aliases (Azure was the original/only provider).
FEMALE_VOICES = AZURE_FEMALE_VOICES
MALE_VOICES = AZURE_MALE_VOICES
DEFAULT_VOICE = AZURE_FEMALE_VOICES[0]


def _pools(provider: str) -> dict[str, list[str]]:
    return VOICE_POOLS.get((provider or "azure").strip().lower(), VOICE_POOLS["azure"])


def default_voice(provider: str = "azure") -> str:
    """The fallback voice for ``provider`` (used when a line has no speaker)."""
    return _pools(provider)["female"][0]


def sample_voices(provider: str = "azure") -> dict[str, str]:
    """A representative ``{"female", "male"}`` voice pair for ``provider``,
    used to audition the provider in the audio-preview command."""
    pools = _pools(provider)
    return {"female": pools["female"][0], "male": pools["male"][0]}


def assign_voices(name_gender: dict[str, str], provider: str = "azure") -> dict[str, str]:
    """Map ``{character_name: gender}`` → ``{character_name: voice}`` for ``provider``.

    ``gender`` is ``"male"``/``"female"`` (anything else is treated as unknown).
    Names are processed in sorted order so the mapping is deterministic across
    reruns, cycling each gender's pool to keep characters distinct.
    """
    pools = _pools(provider)
    female, male = pools["female"], pools["male"]
    # Blended pool for unknown/neutral names so they still alternate and stay distinct.
    neutral = [v for pair in zip(female, male, strict=False) for v in pair]

    assignments: dict[str, str] = {}
    counters = {"male": 0, "female": 0, "neutral": 0}
    for name in sorted(name_gender, key=lambda n: n.lower()):
        gender = (name_gender.get(name) or "").strip().lower()
        if gender == "female":
            assignments[name] = female[counters["female"] % len(female)]
            counters["female"] += 1
        elif gender == "male":
            assignments[name] = male[counters["male"] % len(male)]
            counters["male"] += 1
        else:
            assignments[name] = neutral[counters["neutral"] % len(neutral)]
            counters["neutral"] += 1
    return assignments
