from django.db import models

from base.models import DateTimeUUIDModel

from .user import User


class Folder(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="folders")
    decks = models.ManyToManyField("Deck", related_name="folders")
