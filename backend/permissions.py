from rest_framework import permissions

from backend.deck.domain.access import DeckAccessPolicy
from backend.term.domain.access import TermAccessPolicy

from .models import Deck, Term


class IsOwnerPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "owner", obj)
        return owner == request.user or request.user.is_superuser


class IsOwnerOfRolePermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.deck.owner == request.user


class EditableDeck(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Deck):
        if request.method in permissions.SAFE_METHODS:
            return DeckAccessPolicy.can_view(obj, request.user)
        return DeckAccessPolicy.can_edit(obj, request.user)


class EditableTerm(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Term):
        if request.method in permissions.SAFE_METHODS:
            return DeckAccessPolicy.can_view(obj.deck, request.user)
        return TermAccessPolicy.can_edit(obj, request.user)


class EditableLearningProgress(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user_id == request.user.id
