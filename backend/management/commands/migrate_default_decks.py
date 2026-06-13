from django.core.management.base import BaseCommand

from backend.user.application.services import DEFAULT_DECK_NAME_TEMPLATE

from ...models import User
from ...services import user_service


class Command(BaseCommand):
    help = "Create default decks for users who do not have one."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which users would be updated without creating decks.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        users = User.objects.filter(default_deck__isnull=True).order_by("email")

        if not users.exists():
            self.stdout.write(self.style.SUCCESS("All users already have a default deck."))
            return

        self.stdout.write(f"Found {users.count()} user(s) without a default deck.")

        created_count = 0
        for user in users:
            display_name = (user.name or user.email.split("@")[0]).strip()
            deck_name = DEFAULT_DECK_NAME_TEMPLATE.format(name=display_name)

            if dry_run:
                self.stdout.write(f"[dry-run] Would create '{deck_name}' for {user.email}")
                continue

            deck = user_service.create_default_deck_for_user(user)
            created_count += 1
            self.stdout.write(self.style.SUCCESS(f"Created '{deck.name}' for {user.email}"))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run complete. No changes were made."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Created {created_count} default deck(s)."))
