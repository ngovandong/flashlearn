"""The note document schema: a locked-down subset of ProseMirror/TipTap JSON.

Notes are stored as structured JSON rather than HTML so the server can rebuild
every incoming document from the allowlists below. Anything the editor — or a
crafted request — sends outside them is dropped, so a stored note can never
carry markup or a script into a client.

Colors are stored as palette *names* rather than CSS values. Each client
resolves the name against its own theme tokens, so a note written in light mode
stays readable in dark mode and follows a palette switch.

Images may only point at hosts the caller declares (in practice, our own image
CDN). A pasted third-party URL is re-hosted before it reaches this module, so a
stored note can never hotlink an image that later breaks or phones home.
"""

# Palette names shared by the text-color and highlight marks.
NOTE_COLORS = frozenset({"red", "orange", "green", "blue", "purple", "gray"})

# Guard rails against a pathological document (deep nesting, node floods). A
# note is a study aid, not a wiki, so these are generous but finite.
MAX_NODES = 2_000
MAX_DEPTH = 10
MAX_TEXT_LENGTH = 50_000

_HEADING_LEVELS = (1, 2, 3, 4, 5, 6)
_DEFAULT_HEADING_LEVEL = 2
_SIMPLE_MARKS = frozenset({"bold", "italic", "underline", "strike", "code"})
_LINK_SCHEMES = ("http://", "https://", "mailto:")
MAX_URL_LENGTH = 500
MAX_ALT_LENGTH = 200


def empty_document():
    return {"type": "doc", "content": []}


def sanitize(doc, *, allowed_image_prefixes=()):
    """Rebuild ``doc`` keeping only the allowed nodes, marks and attributes.

    ``allowed_image_prefixes`` are the URL prefixes an ``image`` node's ``src``
    may start with. It defaults to nothing, so a caller that has no image host
    configured stores no images rather than arbitrary ones.
    """
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        return empty_document()
    context = _Context(tuple(allowed_image_prefixes))
    return {"type": "doc", "content": _sanitize_children(doc.get("content"), depth=1, budget=context)}


def to_plain_text(doc):
    """Flatten ``doc`` to text, one line per block, for search and previews."""
    lines = []
    _collect_lines(doc, lines)
    return "\n".join(lines)


def is_empty(doc):
    """Whether a document is worth storing.

    A note made only of images carries no text, so emptiness cannot be decided
    on the flattened text alone.
    """
    return not to_plain_text(doc) and not _has_node(doc, "image")


def _has_node(node, node_type):
    if not isinstance(node, dict):
        return False
    if node.get("type") == node_type:
        return True
    return any(_has_node(child, node_type) for child in node.get("content") or [])


class _Context:
    """Per-document limits and policy, shared across the whole walk.

    The node/text allowances are global rather than per-level so that nesting
    cannot multiply the size of a stored document.
    """

    def __init__(self, image_prefixes=()):
        self.nodes = MAX_NODES
        self.text = MAX_TEXT_LENGTH
        self.image_prefixes = image_prefixes

    @property
    def exhausted(self):
        return self.nodes <= 0

    def take_node(self):
        self.nodes -= 1

    def take_text(self, value):
        allowed = value[: max(self.text, 0)]
        self.text -= len(allowed)
        return allowed


# ── Nodes ─────────────────────────────────────────────────────────────────


def _sanitize_children(content, *, depth, budget):
    if not isinstance(content, list) or depth > MAX_DEPTH:
        return []
    children = []
    for child in content:
        node = _sanitize_node(child, depth=depth, budget=budget)
        if node is not None:
            children.append(node)
    return children


def _sanitize_node(node, *, depth, budget):
    if not isinstance(node, dict) or budget.exhausted:
        return None
    handler = _HANDLERS.get(node.get("type"))
    if handler is None:
        return None
    budget.take_node()
    return handler(node, depth, budget)


def _text_node(node, _depth, budget):
    text = budget.take_text(node.get("text") if isinstance(node.get("text"), str) else "")
    if not text:
        return None
    sanitized = {"type": "text", "text": text}
    marks = _sanitize_marks(node.get("marks"))
    if marks:
        sanitized["marks"] = marks
    return sanitized


def _leaf_node(node, _depth, _budget):
    return {"type": node["type"]}


def _image_node(node, _depth, context):
    attrs = node.get("attrs") or {}
    src = attrs.get("src")
    if not isinstance(src, str) or not src.startswith(context.image_prefixes):
        return None
    image = {"type": "image", "attrs": {"src": src[:MAX_URL_LENGTH]}}
    alt = attrs.get("alt")
    if isinstance(alt, str) and alt.strip():
        image["attrs"]["alt"] = alt.strip()[:MAX_ALT_LENGTH]
    return image


def _container(node_type, *, attrs=None):
    """A node whose children are sanitized recursively."""

    def build(node, depth, budget):
        sanitized = {
            "type": node_type,
            "content": _sanitize_children(node.get("content"), depth=depth + 1, budget=budget),
        }
        if attrs is not None:
            sanitized["attrs"] = attrs(node.get("attrs") or {})
        return sanitized

    return build


def _heading_attrs(attrs):
    level = attrs.get("level")
    return {"level": level if level in _HEADING_LEVELS else _DEFAULT_HEADING_LEVEL}


def _task_item_attrs(attrs):
    return {"checked": bool(attrs.get("checked"))}


def _code_block_attrs(attrs):
    language = attrs.get("language")
    return {"language": language[:32] if isinstance(language, str) else None}


_HANDLERS = {
    "text": _text_node,
    "image": _image_node,
    "hardBreak": _leaf_node,
    "horizontalRule": _leaf_node,
    "paragraph": _container("paragraph"),
    "heading": _container("heading", attrs=_heading_attrs),
    "bulletList": _container("bulletList"),
    "orderedList": _container("orderedList"),
    "listItem": _container("listItem"),
    "taskList": _container("taskList"),
    "taskItem": _container("taskItem", attrs=_task_item_attrs),
    "blockquote": _container("blockquote"),
    "codeBlock": _container("codeBlock", attrs=_code_block_attrs),
}


# ── Marks ─────────────────────────────────────────────────────────────────


def _sanitize_marks(marks):
    if not isinstance(marks, list):
        return []
    sanitized = []
    seen = set()
    for mark in marks:
        if not isinstance(mark, dict):
            continue
        cleaned = _sanitize_mark(mark)
        if cleaned is None or cleaned["type"] in seen:
            continue
        seen.add(cleaned["type"])
        sanitized.append(cleaned)
    return sanitized


def _sanitize_mark(mark):
    mark_type = mark.get("type")
    if mark_type in _SIMPLE_MARKS:
        return {"type": mark_type}
    attrs = mark.get("attrs") or {}
    if mark_type in ("textStyle", "highlight"):
        color = attrs.get("color")
        return {"type": mark_type, "attrs": {"color": color}} if color in NOTE_COLORS else None
    if mark_type == "link":
        href = attrs.get("href")
        if isinstance(href, str) and href.lower().startswith(_LINK_SCHEMES):
            return {"type": "link", "attrs": {"href": href[:MAX_URL_LENGTH]}}
    return None


# ── Flattening ────────────────────────────────────────────────────────────


def _collect_lines(node, lines):
    """Emit one line per text-bearing block (paragraph, heading, code block)."""
    if not isinstance(node, dict):
        return
    children = node.get("content") or []
    if any(isinstance(child, dict) and child.get("type") in ("text", "hardBreak") for child in children):
        line = "".join(child.get("text") or " " for child in children if isinstance(child, dict)).strip()
        if line:
            lines.append(line)
        return
    for child in children:
        _collect_lines(child, lines)
