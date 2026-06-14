from django.db import models
from django.utils.translation import gettext_lazy as _

from base.models import CustomAbstractUser, UUIDModel

from ..managers import CustomUserManager


class User(UUIDModel, CustomAbstractUser):
    name = models.CharField(max_length=255, blank=False, null=False)
    email = models.EmailField(_("email address"), unique=True)
    image_url = models.URLField(_("image url"), max_length=255, blank=True, null=True)
    is_validated_email = models.BooleanField(default=False)
    default_deck = models.OneToOneField("Deck", on_delete=models.SET_NULL, blank=True, null=True)
    learning_streak_count = models.PositiveIntegerField(default=0)
    last_study_date = models.DateField(null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.email

    @property
    def is_google_account(self):
        return not self.has_usable_password()

    def save(self, *args, **kwargs):
        if not self.image_url:
            from cloudinary.utils import cloudinary_url

            url, _ = cloudinary_url("default_avatar")
            self.image_url = url
        super().save(*args, **kwargs)
