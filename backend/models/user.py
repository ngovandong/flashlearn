from django.db import models
from base.models import CustomAbstractUser
from django.utils.translation import gettext_lazy as _
from django.conf import settings

from ..managers import CustomUserManager
from base.models import UUIDModel


class User(UUIDModel, CustomAbstractUser):
    name = models.CharField(max_length=255, blank=False, null=False)
    email = models.EmailField(_("email address"), unique=True)
    image_url = models.URLField(
        _("image url"), max_length=255, blank=True, null=True)
    is_validated_email = models.BooleanField(default=False)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.email

    @property
    def is_google_account(self):
        return not self.has_usable_password()

    def set_default_image(self):
        self.image_url = settings.BASE_URL + \
                         settings.MEDIA_URL + 'default/default_avatar.jpg'

    def save(self, *args, **kwargs):
        if not self.image_url:
            self.set_default_image()
            self.save()
        super().save(*args, **kwargs)
