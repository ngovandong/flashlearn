from django.db import models
from . import User
from base.models import DateTimeUUIDModel


class Deck(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    field = models.CharField(max_length=127)
    users = models.ManyToManyField(User, through='UserDeckRole', related_name='decks')
    owner = models.ForeignKey(User, related_name='my_own_decks', on_delete=models.CASCADE)

    def user_has_permission_in_deck(self, user):
        return user in self.users

    def user_can_edit_deck(self, user):
        return self.owner == user or self.user_roles.filter(user=user, role='E').first()
