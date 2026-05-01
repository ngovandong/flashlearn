from rest_framework import permissions

from .models import Deck, Term


class IsOwnerPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.cache_owner == request.user or request.user.is_superuser


class IsOwnerOfRolePermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.deck.cache_owner == request.user


class EditableDeck(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Deck):
        if request.method in permissions.SAFE_METHODS:
            return obj.user_can_view_deck(request.user)

        return obj.user_can_edit_deck(request.user)


class EditableTerm(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Term):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.can_edit_term(request.user)


class EditableLearningProgress(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Term):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.user_id == request.user.id
