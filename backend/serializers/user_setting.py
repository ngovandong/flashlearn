from rest_framework import serializers

from ..models import UserSetting


class UserSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSetting
        fields = ["key", "value"]
