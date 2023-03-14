from django.db import models
from base.models import UUIDModel
from . import User, Deck


class UserDeckRole(UUIDModel):
    USER_ROLE_CHOICES = (
        ('E', 'Edit'),
        ('V', 'ViewOnly'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='user_roles')
    role = models.CharField(max_length=1, choices=USER_ROLE_CHOICES)
    streaks = models.TextField()

    class Meta:
        unique_together = ('user', 'deck',)