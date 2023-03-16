from django.db import models
from base.models import DateTimeUUIDModel
from cloudinary.models import CloudinaryField
from . import User


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

    @property
    def number_of_term(self):
        return self.terms.count()

    def user_has_permission_in_deck(self, user):
        return user in self.users

    def user_can_edit_deck(self, user):
        return self.owner == user or self.user_roles.filter(user=user, role='E').first() is not None

    def user_is_in_deck(self, user):
        return self.owner == user or self.user_roles.filter(user=user).first() is not None
