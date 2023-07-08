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
        return filtered_queryset

    @staticmethod
    def get_my_own_decks(user):

        my_own_decks = user.my_own_decks.annotate(
            number_of_term=Count('terms', distinct=True)
        ).annotate(
            my_permission=Value('O')
        ).annotate(
            learned=Count('terms__learning_progress__score', filter=Q(
                terms__learning_progress__score__gte=5))
        )

        return my_own_decks

    @staticmethod
    def get_my_others_deck(user):
        ft = Q(user_roles__user=user)
        others_deck = Deck.objects.filter(ft).select_related('owner').annotate(
            my_permission=Case(
                When(user_roles__user=user, then='user_roles__role'),
                When(owner=user, then=Value(FULL_ROLE_CLASS.OWNER)),
                default=Value('null'),
                output_field=CharField(),
            )
        ).annotate(
            number_of_term=Count('terms', distinct=True)
        ).annotate(
            learned=Count('terms__learning_progress__score', filter=Q(
                terms__learning_progress__score__gte=5))
        )

        return others_deck

    @staticmethod
    def get_my_decks(user):
        ft = Q(user_roles__user=user)
        ft |= Q(owner=user)

        my_decks = Deck.objects.filter(ft).distinct().select_related('owner').annotate(
            my_permission=Case(
                When(user_roles__user=user, then='user_roles__role'),
                When(owner=user, then=Value(FULL_ROLE_CLASS.OWNER)),
                default=Value('null'),
                output_field=CharField(),
            )
        ).annotate(
            number_of_term=Count('terms', distinct=True)
        ).annotate(
            learned=Count('terms__learning_progress__score', filter=Q(
                terms__learning_progress__score__gte=5))
        )

        return my_decks

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
