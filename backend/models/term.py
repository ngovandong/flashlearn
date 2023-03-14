from django.db import models
from base.models import UUIDModel
from . import Deck


class Term(UUIDModel):
    term = models.CharField(max_length=255)
    description = models.TextField()
    image_url = models.CharField(max_length=255, blank=True)
    deck = models.ForeignKey(
        Deck, on_delete=models.CASCADE, related_name='terms')
