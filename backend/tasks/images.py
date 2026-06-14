import logging

from django.db.models import Q

from ..models import Term
from ..services.image import is_remote_image_url, url_to_base64

logger = logging.getLogger(__name__)


def convert_term_images_to_base64():
    """
    Download remote term images, compress if needed, and persist as base64 data URIs.
    Runs daily via cron.
    """
    terms = Term.objects.filter(Q(image__startswith="http://") | Q(image__startswith="https://")).only(
        "id", "name", "image"
    )

    converted = failed = 0
    for term in terms.iterator(chunk_size=100):
        if not is_remote_image_url(term.image):
            continue
        try:
            term.image = url_to_base64(term.image)
            term.save(update_fields=["image", "updated_at"])
            converted += 1
        except Exception:
            logger.exception("Failed to convert image for term %s (%s)", term.id, term.name)
            term.image = None
            term.save(update_fields=["image", "updated_at"])
            failed += 1

    logger.info("Term image conversion finished: converted=%d failed=%d", converted, failed)
