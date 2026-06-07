import random
from urllib.parse import urlparse

from cloudinary.models import CloudinaryField
from cloudinary.utils import cloudinary_url
from django.db import models

from base.models import DateTimeUUIDModel

from ..constants import FULL_ROLE_CLASS
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
        if user == self.owner or user.is_superuser:
            return FULL_ROLE_CLASS.OWNER
        for role in self.user_roles.all():
            if role.user == user:
                return role.role
        return None

    def user_can_edit_deck(self, user):
        if user.is_superuser:
            return True
        user_role = self.get_user_permission(user)
        if user_role is None:
            return False
        return user_role in [FULL_ROLE_CLASS.EDIT, FULL_ROLE_CLASS.OWNER]

    def user_is_in_deck(self, user):
        return self.get_user_permission(user) is not None

    def user_can_view_deck(self, user):
        return self.is_public or self.get_user_permission(user) or user.is_superuser

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
