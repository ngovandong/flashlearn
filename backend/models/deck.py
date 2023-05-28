from django.db import models
from cloudinary.models import CloudinaryField
from base.models import DateTimeUUIDModel
from . import User
from ..constants import FULL_ROLE_CLASS


class Deck(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    is_public = models.BooleanField(default=True)
    background = CloudinaryField("image", blank=True, null=True)

    field = models.CharField(max_length=127)
    users = models.ManyToManyField(
        User, through='UserDeckRole', related_name='decks')
    owner = models.ForeignKey(
        User, related_name='my_own_decks', on_delete=models.CASCADE)

    def get_user_permission(instance, user):
        if user == instance.owner:
            return FULL_ROLE_CLASS.OWNER
        else:
            role = None
            for r in instance.user_roles.all():
                if r.user == user:
                    role = r.role
            return role

    def user_can_edit_deck(self, user):
        user_role = self.get_user_permission(user)
        if user_role is None:
            return False
        return user_role in [FULL_ROLE_CLASS.EDIT, FULL_ROLE_CLASS.OWNER]

    def user_is_in_deck(self, user):
        return self.get_user_permission(user) is not None

    def user_can_view_deck(self, user):
        return self.is_public or self.get_user_permission(user)
