from django.core.management.base import BaseCommand
from django.utils import timezone

from ...models import UserLearningProgress


class Command(BaseCommand):
    help = "Reset learning progress today"

    def handle(self, *args, **options):
        deck_id = input("Enter deck_id: ")
        email = input("Enter user_email: ")
        today = timezone.now().date()
        yesterday = timezone.now() - timezone.timedelta(days=1)
        try:
            user_learning_progress_list = UserLearningProgress.objects.filter(
                term__deck_id=deck_id, user__email=email, last_learned_at__date=today
            )
            num_updated = user_learning_progress_list.update(last_learned_at=yesterday)
            print(f"Updated {num_updated} UserLearningProgress objects.")
        except Exception as e:
            print(e)
