"""Upload a cover/background image for a course to Cloudinary.

Takes a local image file, uploads it to our Cloudinary and stores the hosted URL
on ``Course.background`` (shown on the course catalog card).

    uv run python manage.py set_course_background --slug a2-english-for-developers --file /tmp/a2.svg
"""

from django.core.management.base import BaseCommand, CommandError

from backend.services import course_service
from backend.shared.application.exceptions import NotFoundError, ValidationError


class Command(BaseCommand):
    help = "Upload a course cover image to Cloudinary and save it on the course."

    def add_arguments(self, parser):
        parser.add_argument("--slug", required=True, help="Course slug.")
        parser.add_argument("--file", required=True, help="Path to the local image file.")

    def handle(self, *args, **opts):
        try:
            with open(opts["file"], "rb") as fh:
                url = course_service.set_course_background(opts["slug"], fh)
        except (FileNotFoundError, NotFoundError, ValidationError) as exc:
            raise CommandError(str(exc))
        self.stdout.write(self.style.SUCCESS(f"{opts['slug']} background → {url}"))
