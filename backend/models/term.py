from django.db import models
from base.models import UUIDModel
from . import Deck
from ..managers import TermManager


class Term(UUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    image = models.TextField(blank=True, null=True)
    deck = models.ForeignKey(
        Deck, on_delete=models.CASCADE, related_name='terms')

    objects = TermManager()

    def can_edit_term(self, user):
        return self.deck.owner == user or self.deck.user_roles.filter(user=user, role='E').first() is not None
