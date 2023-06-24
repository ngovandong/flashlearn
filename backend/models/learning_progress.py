from django.db import models
from base.models import UUIDModel
from . import User, Term


class UserLearningProgress(UUIDModel):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='learning_progress')
    term = models.ForeignKey(
        Term, on_delete=models.CASCADE, related_name='learning_progress')
    last_learned_at = models.DateTimeField(auto_now_add=True)
    score = models.IntegerField(default=0)
    is_skip = models.BooleanField(default=False)

    class Meta:
        ordering = ('last_learned_at',)
