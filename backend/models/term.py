from django.db import models

from base.models import DateTimeUUIDModel

from ..managers import TermManager
from ..term.domain.access import TermAccessPolicy
from .deck import Deck


class Term(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    image = models.TextField(blank=True, null=True)
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="terms")

    objects = TermManager()

    class Meta:
        ordering = ["-created_at", "name"]

    def can_edit_term(self, user):
        return TermAccessPolicy.can_edit(self, user)
