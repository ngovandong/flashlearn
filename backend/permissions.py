from rest_framework import permissions
from .models import Deck, Term


class IsOwnerPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class IsOwnerOfRolePermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.deck.owner == request.user


class EditableDeck(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Deck):
        if request.method in permissions.SAFE_METHODS:
            return obj.is_public or obj.user_is_in_deck(request.user)

        return obj.user_can_edit_deck(request.user)


class EditableTerm(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Term):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.can_edit_term(request.user)
