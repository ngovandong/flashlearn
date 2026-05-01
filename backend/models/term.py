from django.db import models

from base.models import DateTimeUUIDModel

from ..managers import TermManager
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
        return self.deck.owner == user or self.deck.user_roles.filter(user=user, role="E").first() is not None
