from rest_framework import serializers
from ..models import Folder
from . import UserSerializer


class FolderSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Folder
        fields = ('id', 'name', 'description', 'owner', 'created_at', 'updated_at')
