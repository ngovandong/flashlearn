from rest_framework import permissions
from .models import Deck


class IsOwnerPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class EditableDeck(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Deck):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.user_can_edit_deck(request.user)


class OwnerOfDeck(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Deck):
        return obj.owner == request.user
