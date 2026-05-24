from django.db import models

from base.models import DateTimeUUIDModel


class UserSetting(DateTimeUUIDModel):
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="settings",
        db_constraint=False,
    )
    key = models.CharField(max_length=100)
    value = models.JSONField()

    class Meta(DateTimeUUIDModel.Meta):  # type: ignore[misc]
        abstract = False
        unique_together = ("user", "key")

    def __str__(self):
        return f"{self.key} = {self.value}"
