from django.db.models import Case, CharField, Q, Value, When, Count, Sum, Max, DateTimeField, IntegerField, Prefetch
from django.db.models.functions import Coalesce
from django.db import transaction
import datetime
from ..models import Deck, UserDeckRole, Term
from ..constants import FULL_ROLE_CLASS


class DeckService:
    @staticmethod
    def get_retrieve_queryset(user):
        prefetch = Prefetch(
            "user_roles", queryset=UserDeckRole.objects.select_related('user'))
        queryset = Deck.objects.select_related(
            'owner').prefetch_related(prefetch)
        return queryset

    @staticmethod
    def get_search_queryset(user, search_query):
        if user.is_superuser:
            return Deck.objects.all()
        queryset = Deck.objects.filter(
            Q(is_public=True) | Q(owner=user) | Q(users=user)
        ).select_related('owner')

        if search_query:
            # Filter by search query and term count
            queryset = queryset.annotate(term_count=Count('terms'))
            filtered_queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(owner__name__icontains=search_query) |
                Q(owner__email__icontains=search_query),
                term_count__gt=0
            )
        else:
            # Return the original queryset if no search query is specified
            filtered_queryset = queryset
        return filtered_queryset.distinct()

    @staticmethod
    def get_my_own_decks(user):

        my_own_decks = user.my_own_decks.annotate(
            number_of_term=Count('terms', distinct=True)
        )

        return my_own_decks

    @staticmethod
    def get_my_others_deck(user):
        deck_ids = list(UserDeckRole.objects.filter(
            user_id=user.id).values_list("deck_id", flat=True))

        others_deck = Deck.objects.filter(id__in=deck_ids).select_related('owner').annotate(
        ).annotate(
            number_of_term=Count('terms', distinct=True)
        )

        return others_deck

    @staticmethod
    def get_my_decks(user):
        deck_ids = list(UserDeckRole.objects.filter(
            user_id=user.id).values_list("deck_id", flat=True))
        deck_ids += list(Deck.objects.filter(owner_id=user.id).values_list("id", flat=True))

        my_decks = Deck.objects.filter(id__in=deck_ids).select_related(
            'owner'
        ).annotate(
            number_of_term=Count('terms', distinct=True)
        )

        return my_decks

    @staticmethod
    def get_public_decks(user):
        deck_ids = list(UserDeckRole.objects.filter(
            user_id=user.id).values_list("deck_id", flat=True))
        deck_ids += list(Deck.objects.filter(owner_id=user.id).values_list("id", flat=True))

        decks = Deck.objects.filter(
            is_public=True
        ).exclude(
            id__in=deck_ids
        ).select_related(
            'owner'
        ).annotate(
            number_of_term=Count('terms', distinct=True)
        ).order_by('-number_of_term')[:5]

        return decks

    # @staticmethod
    # def get_latest_decks(user):
    #     latest_decks = DeckService.get_my_decks(user).annotate(
    #         latest_learned=Coalesce(Max('terms__learning_progress__last_learned_at', filter=Q(
    #             terms__learning_progress__user=user)), Value(datetime.datetime(1900, 1, 1), output_field=DateTimeField()))
    #     ).order_by('-latest_learned')[:5]

    #     return latest_decks

    @staticmethod
    def get_latest_decks(user):
        latest_decks = DeckService.get_my_decks(
            user).order_by('-updated_at')[:5]

        return latest_decks

    @staticmethod
    def clone_deck(old_deck, user):
        with transaction.atomic():
            # Cloning the deck object
            new_deck_name = "Copy of " + old_deck.owner.name + " - " + old_deck.name
            new_deck = Deck.objects.create(
                name=new_deck_name,
                description=old_deck.description,
                is_public=False,
                background=old_deck.background,
                field=old_deck.field,
                owner=user
            )

            # Cloning the term objects associated with the old deck
            old_terms = old_deck.terms.all()
            new_terms = [
                Term(
                    name=term.name,
                    description=term.description,
                    image=term.image,
                    deck=new_deck
                )
                for term in old_terms
            ]
            Term.objects.bulk_create(new_terms)

        return new_deck

    @staticmethod
    def leave_deck(deck, user):
        with transaction.atomic():
            user.learning_progress.filter(term__deck_id=deck.id).delete()
            deck.users.remove(user)
