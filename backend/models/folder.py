from django.db import models
from . import User
from base.models import DateTimeUUIDModel


class Folder(DateTimeUUIDModel):
    name = models.CharField(max_length=255)
    description = models.TextField()
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='folders')
