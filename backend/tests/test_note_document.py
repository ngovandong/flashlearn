from django.test import SimpleTestCase

from backend.note.domain import document


def _doc(*content):
    return {"type": "doc", "content": list(content)}


def _para(*content):
    return {"type": "paragraph", "content": list(content)}


def _text(text, marks=None):
    node = {"type": "text", "text": text}
    if marks is not None:
        node["marks"] = marks
    return node


class SanitizeNodesTest(SimpleTestCase):
    def test_keeps_supported_formatting(self):
        doc = _doc(
            {"type": "heading", "attrs": {"level": 3}, "content": [_text("Phrasal verbs")]},
            {
                "type": "bulletList",
                "content": [{"type": "listItem", "content": [_para(_text("give up", [{"type": "bold"}]))]}],
            },
            {
                "type": "taskList",
                "content": [{"type": "taskItem", "attrs": {"checked": True}, "content": [_para(_text("revise"))]}],
            },
        )
        self.assertEqual(document.sanitize(doc), doc)

    def test_drops_unknown_nodes(self):
        doc = _doc(
            {"type": "image", "attrs": {"src": "http://x/y.png"}},
            {"type": "iframe", "content": [_text("nope")]},
            _para(_text("kept")),
        )
        self.assertEqual(document.sanitize(doc), _doc(_para(_text("kept"))))

    def test_non_document_input_becomes_empty(self):
        for value in (None, "", [], {"type": "paragraph"}):
            self.assertEqual(document.sanitize(value), document.empty_document())

    def test_heading_levels_survive(self):
        for level in document._HEADING_LEVELS:
            doc = _doc({"type": "heading", "attrs": {"level": level}, "content": [_text("Title")]})
            self.assertEqual(document.sanitize(doc)["content"][0]["attrs"], {"level": level})

    def test_out_of_range_heading_level_falls_back(self):
        doc = _doc({"type": "heading", "attrs": {"level": 9}, "content": [_text("Title")]})
        self.assertEqual(document.sanitize(doc)["content"][0]["attrs"], {"level": 2})

    def test_nesting_beyond_the_depth_limit_is_dropped(self):
        node = _para(_text("deep"))
        for _ in range(document.MAX_DEPTH + 2):
            node = {"type": "blockquote", "content": [node]}
        self.assertEqual(document.to_plain_text(document.sanitize(_doc(node))), "")

    def test_node_count_is_capped(self):
        doc = _doc(*[_para(_text(f"line {i}")) for i in range(document.MAX_NODES)])
        # Each paragraph costs two nodes (the block and its text), so the flood
        # is truncated rather than stored whole.
        self.assertLess(len(document.sanitize(doc)["content"]), document.MAX_NODES)

    def test_text_length_is_capped(self):
        doc = _doc(_para(_text("a" * (document.MAX_TEXT_LENGTH + 500))))
        self.assertEqual(len(document.to_plain_text(document.sanitize(doc))), document.MAX_TEXT_LENGTH)


class SanitizeMarksTest(SimpleTestCase):
    def _marks_of(self, marks):
        sanitized = document.sanitize(_doc(_para(_text("word", marks))))
        return sanitized["content"][0]["content"][0].get("marks", [])

    def test_keeps_palette_colors(self):
        self.assertEqual(
            self._marks_of([{"type": "highlight", "attrs": {"color": "blue"}}]),
            [{"type": "highlight", "attrs": {"color": "blue"}}],
        )

    def test_drops_raw_css_colors(self):
        # Colors are palette names so each client resolves them against its own
        # theme; anything else (including valid CSS) is not storable.
        for color in ("#ff0000", "red ", "var(--fl-primary)", "rgb(1,2,3)"):
            self.assertEqual(self._marks_of([{"type": "textStyle", "attrs": {"color": color}}]), [])

    def test_drops_unknown_marks(self):
        self.assertEqual(self._marks_of([{"type": "fontSize", "attrs": {"size": "80px"}}]), [])

    def test_link_scheme_is_restricted(self):
        self.assertEqual(
            self._marks_of([{"type": "link", "attrs": {"href": "https://ok.example"}}]),
            [{"type": "link", "attrs": {"href": "https://ok.example"}}],
        )
        for href in ("javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", None):
            self.assertEqual(self._marks_of([{"type": "link", "attrs": {"href": href}}]), [])

    def test_duplicate_marks_are_collapsed(self):
        self.assertEqual(self._marks_of([{"type": "bold"}, {"type": "bold"}]), [{"type": "bold"}])


class PlainTextTest(SimpleTestCase):
    def test_one_line_per_block(self):
        doc = _doc(
            {"type": "heading", "attrs": {"level": 2}, "content": [_text("Notes")]},
            {
                "type": "bulletList",
                "content": [
                    {"type": "listItem", "content": [_para(_text("first"))]},
                    {"type": "listItem", "content": [_para(_text("second"))]},
                ],
            },
        )
        self.assertEqual(document.to_plain_text(doc), "Notes\nfirst\nsecond")

    def test_joins_marked_runs_within_a_block(self):
        doc = _doc(_para(_text("give "), _text("up", [{"type": "bold"}])))
        self.assertEqual(document.to_plain_text(doc), "give up")

    def test_blank_documents_are_empty(self):
        for doc in (document.empty_document(), _doc(_para()), _doc(_para(_text("   ")))):
            self.assertTrue(document.is_empty(doc))

    def test_document_with_text_is_not_empty(self):
        self.assertFalse(document.is_empty(_doc(_para(_text("something")))))


class ImageTest(SimpleTestCase):
    CDN = "https://cdn.example.com/"

    def _sanitize(self, *nodes):
        return document.sanitize(_doc(*nodes), allowed_image_prefixes=(self.CDN,))

    def _image(self, src, **attrs):
        return {"type": "image", "attrs": {"src": src, **attrs}}

    def test_keeps_an_image_hosted_on_an_allowed_prefix(self):
        doc = self._sanitize(self._image(self.CDN + "note.png", alt=" a diagram "))
        self.assertEqual(
            doc["content"], [{"type": "image", "attrs": {"src": self.CDN + "note.png", "alt": "a diagram"}}]
        )

    def test_drops_an_image_hosted_elsewhere(self):
        doc = self._sanitize(self._image("https://tracker.example.net/pixel.gif"))
        self.assertEqual(doc["content"], [])

    def test_drops_every_image_when_no_host_is_configured(self):
        doc = document.sanitize(_doc(self._image(self.CDN + "note.png")))
        self.assertEqual(doc["content"], [])

    def test_drops_a_non_http_source(self):
        for src in ("javascript:alert(1)", "data:image/svg+xml;base64,AAAA", 42):
            self.assertEqual(self._sanitize(self._image(src))["content"], [])

    def test_an_image_only_note_is_not_empty(self):
        self.assertFalse(document.is_empty(self._sanitize(self._image(self.CDN + "note.png"))))
