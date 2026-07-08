"""PDF text extraction (with OCR fallback) for the grammar importer.

Kept in infrastructure so the application layer never talks to PDF/OCR libraries
(or the network) directly. Heavy libs are imported lazily so the rest of the app
— and the composition root — never depend on them being installed; only the
``import_grammar_book`` command needs them.

Many grammar ebooks (including *Essential Grammar in Use*) are **scanned** PDFs:
the pages are images with no embedded text layer, so a plain text extractor
returns empty strings for every page. We therefore render each page with PyMuPDF
and OCR it with Tesseract when (and only when) the page has no usable text.
"""

import io
from pathlib import Path

import requests


def load_pdf_bytes(source: str) -> bytes:
    """Return the raw bytes of a PDF given a local path or an http(s) URL."""
    if source.startswith("http://") or source.startswith("https://"):
        response = requests.get(source, timeout=120)
        response.raise_for_status()
        return response.content
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {source}")
    return path.read_bytes()


def _open_document(source: str):
    try:
        import pymupdf  # noqa: F401 — modern import name

        fitz = pymupdf
    except ImportError:  # pragma: no cover
        try:
            import fitz  # legacy alias still shipped by pymupdf
        except ImportError as exc:  # pragma: no cover - clear operator guidance
            raise RuntimeError(
                "PyMuPDF is required to read a grammar PDF. Install it with `uv sync` "
                "(pymupdf is a project dependency) and retry."
            ) from exc
    return fitz.open(stream=load_pdf_bytes(source), filetype="pdf")


def _ocr_page(page, dpi: int, lang: str) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:  # pragma: no cover - clear operator guidance
        raise RuntimeError(
            "OCR requires pytesseract + Pillow. Install them with `uv sync` and make sure the "
            "`tesseract` binary is on PATH (e.g. `brew install tesseract`)."
        ) from exc

    pix = page.get_pixmap(dpi=dpi)
    image = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(image, lang=lang)


def extract_pages(
    source: str,
    *,
    ocr: str = "auto",
    dpi: int = 200,
    lang: str = "eng",
) -> list[str]:
    """Extract text page-by-page from a PDF (local path or URL).

    ``ocr`` controls the image-OCR fallback:

    - ``"auto"`` (default): OCR only pages that have no embedded text layer.
    - ``"always"``: OCR every page (use for scanned books that also carry a junk
      text layer).
    - ``"never"``: text layer only (fast; returns empty strings for scanned pages).

    Returns one string per page. Extraction from a laid-out workbook is
    best-effort — the AI structuring step makes sense of the noisy ordering.
    """
    doc = _open_document(source)
    try:
        pages = []
        for page in doc:
            text = (page.get_text() or "").strip()
            needs_ocr = ocr == "always" or (ocr == "auto" and not text)
            if needs_ocr:
                text = (_ocr_page(page, dpi, lang) or "").strip()
            pages.append(text)
        return pages
    finally:
        doc.close()
