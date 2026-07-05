"""Hand-authored SVG cover art for the listening (dictation) topics.

Pure presentation data — no ORM. Each topic gets an on-brand, content-matched
1200x630 cover that matches the freeCodeCamp course cover system (gradient +
white line-art motif + level chip + wrapped title), with a "Listening dictation"
footer so the whole set reads as one family on the /course "Listening course" tab.

The illustration for each topic is drawn in a 0..100 box (white line-art, same
language as the course motifs) and scaled into the top-right of the cover. Uploaded
to Cloudinary and stored on ``ListeningTopic.background`` (see
``ListeningService.set_topic_cover_svg``).
"""

# Each entry: gradient stops (c1→c2) + the topic illustration markup.
# Illustrations use fill="none" stroke="#fff" by default (set on the parent <g>);
# solid shapes/text set their own fill and stroke="none".
_COVERS = {
    "short-stories": {
        "c1": "#6C5CE7",
        "c2": "#8E7CF0",
        # Open book with lines of text on both pages.
        "art": (
            '<path d="M50 22 C40 14 20 14 8 20 L8 80 C20 74 40 74 50 82 '
            'C60 74 80 74 92 80 L92 20 C80 14 60 14 50 22 Z"/>'
            '<line x1="50" y1="22" x2="50" y2="82"/>'
            '<path d="M16 34 h24 M16 46 h24 M16 58 h18"/>'
            '<path d="M60 34 h24 M60 46 h24 M60 58 h18"/>'
        ),
    },
    "english-conversations": {
        "c1": "#0EA5E9",
        "c2": "#38BDF8",
        # Two overlapping speech bubbles (a back-and-forth chat).
        "art": (
            '<path d="M6 8 h46 a9 9 0 0 1 9 9 v5 h-26 a11 11 0 0 0 -11 11 v10 '
            'h-9 l0 0 h-9 a9 9 0 0 1 -9 -9 v-17 a9 9 0 0 1 9 -9 Z"/>'
            '<path d="M34 30 h52 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-6 '
            'v12 l-15 -12 h-31 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 Z"/>'
            '<circle cx="52" cy="51" r="3.4" fill="#fff" stroke="none"/>'
            '<circle cx="66" cy="51" r="3.4" fill="#fff" stroke="none"/>'
            '<circle cx="80" cy="51" r="3.4" fill="#fff" stroke="none"/>'
        ),
    },
    "toeic": {
        "c1": "#4255FF",
        "c2": "#7C8CFF",
        # Business briefcase (workplace English).
        "art": (
            '<rect x="8" y="34" width="84" height="54" rx="9"/>'
            '<path d="M38 34 v-9 a5 5 0 0 1 5 -5 h14 a5 5 0 0 1 5 5 v9"/>'
            '<line x1="8" y1="60" x2="92" y2="60"/>'
            '<rect x="43" y="53" width="14" height="14" rx="3"/>'
        ),
    },
    "ielts-listening": {
        "c1": "#0891B2",
        "c2": "#22D3EE",
        # Globe (British/Australian & international accents).
        "art": (
            '<circle cx="50" cy="50" r="40"/>'
            '<ellipse cx="50" cy="50" rx="16" ry="40"/>'
            '<line x1="10" y1="50" x2="90" y2="50"/>'
            '<path d="M15 32 h70 M15 68 h70"/>'
        ),
    },
    "toefl-listening": {
        "c1": "#7C3AED",
        "c2": "#A78BFA",
        # Graduation cap with tassel (academic lectures).
        "art": (
            '<path d="M50 20 L92 38 L50 56 L8 38 Z"/>'
            '<path d="M26 47 v18 c0 7 48 7 48 0 v-18"/>'
            '<line x1="88" y1="40" x2="88" y2="66"/>'
            '<circle cx="88" cy="70" r="3.5" fill="#fff" stroke="none"/>'
        ),
    },
    "medical-english-oet": {
        "c1": "#059669",
        "c2": "#34D399",
        # Medical cross badge + heartbeat line.
        "art": (
            '<rect x="16" y="12" width="68" height="60" rx="15"/>'
            '<path d="M43 24 h14 v12 h12 v14 h-12 v12 h-14 v-12 h-12 v-14 h12 Z" '
            'fill="#fff" stroke="none"/>'
            '<path d="M12 84 h20 l6 -12 l8 22 l7 -16 l4 6 h23"/>'
        ),
    },
    "numbers": {
        "c1": "#EA580C",
        "c2": "#FB923C",
        # Literal digits (train your ear for spoken numbers).
        "art": (
            '<text x="2" y="70" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
            'font-size="64" font-weight="800" fill="#fff" stroke="none">123</text>'
        ),
    },
    "spelling-names": {
        "c1": "#DB2777",
        "c2": "#F472B6",
        # Alphabet letters (spelling out names).
        "art": (
            '<text x="2" y="68" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
            'font-size="54" font-weight="800" fill="#fff" stroke="none">ABC</text>'
        ),
    },
}

_DEFAULT = {
    "c1": "#4255FF",
    "c2": "#7C8CFF",
    # Headphones (generic listening motif).
    "art": (
        '<path d="M14 56 v-6 a36 36 0 0 1 72 0 v6"/>'
        '<rect x="8" y="54" width="18" height="30" rx="8"/>'
        '<rect x="74" y="54" width="18" height="30" rx="8"/>'
    ),
}


def _wrap(title, max_chars=15):
    words, lines, cur = title.split(), [], ""
    for word in words:
        if cur and len(cur) + len(word) + 1 > max_chars:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    if cur:
        lines.append(cur)
    return lines[:3]


def cover_svg(title, level, slug):
    """Return SVG markup for a topic cover matching the course cover system."""
    theme = _COVERS.get(slug, _DEFAULT)
    title_lines = _wrap(title)
    line_h = 92
    start_y = 360 - (len(title_lines) - 1) * line_h // 2
    tspans = "".join(
        f'<text x="96" y="{start_y + i * line_h}" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        f'font-size="84" font-weight="800" fill="#ffffff">{line}</text>'
        for i, line in enumerate(title_lines)
    )
    chip_w = max(150, 70 + len(level or "Listening") * 22)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{theme["c1"]}"/><stop offset="1" stop-color="{theme["c2"]}"/>'
        "</linearGradient></defs>"
        '<rect width="1200" height="630" fill="url(#g)"/>'
        '<circle cx="1040" cy="120" r="220" fill="#ffffff" opacity="0.08"/>'
        '<circle cx="1140" cy="560" r="160" fill="#ffffff" opacity="0.07"/>'
        '<g transform="translate(815,150) scale(3.0)" fill="none" stroke="#ffffff" '
        'stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">'
        f"{theme['art']}</g>"
        f'<rect x="96" y="84" width="{chip_w}" height="56" rx="28" fill="#ffffff" opacity="0.18"/>'
        '<text x="120" y="122" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        f'font-size="34" font-weight="700" fill="#ffffff">{level or "Listening"}</text>'
        f"{tspans}"
        '<text x="96" y="540" font-family="Segoe UI, Helvetica, Arial, sans-serif" '
        'font-size="30" font-weight="500" fill="#ffffff" opacity="0.85">'
        "FlashLearn &#183; Listening dictation</text>"
        "</svg>"
    )
