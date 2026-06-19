"""Character voice assignment for course dialogues.

Each dialogue character is given a stable Azure neural voice that matches their
gender, so the generated audio sounds consistent across every lesson. Voices are
handed out round-robin within a gender pool, so distinct characters of the same
gender still sound different from one another.
"""

# Azure en-US neural voices grouped by gender. Each name is used verbatim as the
# Azure TTS voice id in the synthesis request.
FEMALE_VOICES = [
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
MALE_VOICES = [
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

DEFAULT_VOICE = FEMALE_VOICES[0]

# Blended pool for unknown/neutral names so they still alternate and stay distinct.
_NEUTRAL_VOICES = [v for pair in zip(FEMALE_VOICES, MALE_VOICES, strict=False) for v in pair]


def assign_voices(name_gender: dict[str, str]) -> dict[str, str]:
    """Map ``{character_name: gender}`` → ``{character_name: azure_voice}``.

    ``gender`` is ``"male"``/``"female"`` (anything else is treated as unknown).
    Names are processed in sorted order so the mapping is deterministic across
    reruns, cycling each gender's pool to keep characters distinct.
    """
    assignments: dict[str, str] = {}
    counters = {"male": 0, "female": 0, "neutral": 0}
    for name in sorted(name_gender, key=lambda n: n.lower()):
        gender = (name_gender.get(name) or "").strip().lower()
        if gender == "female":
            assignments[name] = FEMALE_VOICES[counters["female"] % len(FEMALE_VOICES)]
            counters["female"] += 1
        elif gender == "male":
            assignments[name] = MALE_VOICES[counters["male"] % len(MALE_VOICES)]
            counters["male"] += 1
        else:
            assignments[name] = _NEUTRAL_VOICES[counters["neutral"] % len(_NEUTRAL_VOICES)]
            counters["neutral"] += 1
    return assignments
