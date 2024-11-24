from django.core.management.base import BaseCommand
from ...models import Term
from ...services import url_to_base64


class Command(BaseCommand):
    help = "Convert all images to base64"

    def handle(self, *args, **options):
        terms = Term.objects.filter(image__startswith="https:")
        print("Total terms: ", terms.count())
        for term in terms:
            try:
                term.image = url_to_base64(term.image)
                term.save()
            except Exception as e:
                print(f"Term {term.id} {term.name} failed!")
                continue
