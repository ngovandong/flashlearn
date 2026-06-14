from django.core.management.base import BaseCommand

from ...tasks.images import convert_term_images_to_base64


class Command(BaseCommand):
    help = "Convert all remote term images to base64 (same logic as the daily cron job)"

    def handle(self, *args, **options):
        convert_term_images_to_base64()
