import random
from urllib.parse import urlparse

from cloudinary.models import CloudinaryField
from cloudinary.utils import cloudinary_url
from django.db import models

from base.models import DateTimeUUIDModel

from ..deck.domain.access import DeckAccessPolicy
from .user import User


class Deck(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    is_public = models.BooleanField(default=True)
    background = CloudinaryField("image", blank=True, null=True)

    field = models.CharField(max_length=127)
    users = models.ManyToManyField(User, through="UserDeckRole", related_name="decks")
    owner = models.ForeignKey(User, related_name="my_own_decks", on_delete=models.CASCADE)

    class Meta:
        ordering = ("created_at",)

    def get_user_permission(self, user):
        return DeckAccessPolicy.get_user_role(self, user)

    def user_can_edit_deck(self, user):
        return DeckAccessPolicy.can_edit(self, user)

    def user_is_in_deck(self, user):
        return DeckAccessPolicy.is_member(self, user)

    def user_can_view_deck(self, user):
        return DeckAccessPolicy.can_view(self, user)

    @staticmethod
    def default_background_path():
        random_number = random.randint(1, 5)
        random_background = f"background_{random_number}"
        url, _ = cloudinary_url(random_background)
        parsed_url = urlparse(url)
        path = parsed_url.path.lstrip("/")
        return path[path.index("/", 1) + 1 :]

    def save(self, *args, **kwargs):
        if not self.background:
            self.background = self.default_background_path()
        super().save(*args, **kwargs)
