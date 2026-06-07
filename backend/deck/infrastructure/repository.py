from django.db import transaction
from django.db.models import Count, Prefetch, Q

from backend.deck.infrastructure.sql_queries import (
    fetch_member_deck_ids,
    fetch_top_public_deck_ids,
    fetch_user_deck_ids,
)
from backend.models import Deck, Term, User, UserDeckRole


class DeckRepository:
    @staticmethod
    def get_by_id(deck_id):
        return Deck.objects.filter(pk=deck_id).first()

    @staticmethod
    def get_retrieve_queryset(user):
        prefetch = Prefetch("user_roles", queryset=UserDeckRole.objects.select_related("user"))
        return Deck.objects.select_related("owner").prefetch_related(prefetch)

    @staticmethod
    def get_search_queryset(user, search_query):
        if user.is_superuser:
            return Deck.objects.all()
        queryset = Deck.objects.filter(Q(is_public=True) | Q(owner=user) | Q(users=user)).select_related("owner")

        if search_query:
            queryset = queryset.annotate(term_count=Count("terms"))
            filtered_queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(owner__name__icontains=search_query)
                | Q(owner__email__icontains=search_query),
                term_count__gt=0,
            )
        else:
            filtered_queryset = queryset
        return filtered_queryset.distinct()

    @staticmethod
    def get_my_own_decks(user):
        return user.my_own_decks.annotate(number_of_term=Count("terms", distinct=True))

    @staticmethod
    def _decks_with_term_count(deck_ids):
        if not deck_ids:
            return Deck.objects.none()
        return (
            Deck.objects.filter(id__in=deck_ids)
            .select_related("owner")
            .annotate(number_of_term=Count("terms", distinct=True))
        )

    @staticmethod
    def get_my_others_deck(user):
        return DeckRepository._decks_with_term_count(fetch_member_deck_ids(user.id))

    @staticmethod
    def get_my_decks(user):
        return DeckRepository._decks_with_term_count(fetch_user_deck_ids(user.id))

    @staticmethod
    def get_public_decks(user):
        deck_ids = fetch_top_public_deck_ids(user.id)
        if not deck_ids:
            return Deck.objects.none()
        decks = {str(deck.id).replace("-", ""): deck for deck in DeckRepository._decks_with_term_count(deck_ids)}
        return [decks[deck_id] for deck_id in deck_ids if deck_id in decks]

    @staticmethod
    def get_latest_decks(user):
        return DeckRepository.get_my_decks(user).order_by("-updated_at")[:5]

    @staticmethod
    def touch_updated_at(deck):
        from django.utils import timezone

        deck.updated_at = timezone.now()
        deck.save(update_fields=["updated_at"])

    @staticmethod
    def clear_default_deck_for_users(deck):
        User.objects.filter(default_deck=deck).update(default_deck=None)

    @staticmethod
    def add_user(deck, user, role):
        deck.users.add(user, through_defaults={"role": role})

    @staticmethod
    def remove_user(deck, user):
        deck.users.remove(user)

    @staticmethod
    def user_in_deck(deck, user):
        return user in deck.users.all()

    @staticmethod
    def clone_deck(old_deck, user):
        with transaction.atomic():
            new_deck_name = "Copy of " + old_deck.owner.name + " - " + old_deck.name
            new_deck = Deck.objects.create(
                name=new_deck_name,
                description=old_deck.description,
                is_public=False,
                background=old_deck.background,
                field=old_deck.field,
                owner=user,
            )
            old_terms = old_deck.terms.all()
            new_terms = [
                Term(name=term.name, description=term.description, image=term.image, deck=new_deck)
                for term in old_terms
            ]
            Term.objects.bulk_create(new_terms)
        return new_deck

    @staticmethod
    def leave_deck(deck, user):
        with transaction.atomic():
            user.learning_progress.filter(term__deck_id=deck.id).delete()
            deck.users.remove(user)

    @staticmethod
    def set_default_deck(user, deck):
        user.default_deck = deck
        user.save(update_fields=["default_deck"])
