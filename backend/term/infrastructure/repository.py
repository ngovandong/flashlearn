from backend.models import Deck, Term
from backend.term.infrastructure.sql_queries import fetch_latest_learned_term_info, fetch_revise_terms


class TermRepository:
    @staticmethod
    def get_by_id(term_id):
        return Term.objects.filter(pk=term_id).first()

    @staticmethod
    def get_terms_for_deck(deck_id, user=None):
        return Term.objects.get_terms_for_deck(deck_id=deck_id, user=user)

    @staticmethod
    def get_learned_terms(user, deck_id):
        return Term.objects.get_learned_terms(user, deck_id)

    @staticmethod
    def get_last_learned_term(user, deck_id):
        return Term.objects.get_last_learned_term(user, deck_id)

    @staticmethod
    def get_revise_terms(user, deck_id):
        return fetch_revise_terms(user.id, deck_id)

    @staticmethod
    def get_latest_learned_term_info(user, deck_id, page_size=10):
        return fetch_latest_learned_term_info(user.id, deck_id, page_size)

    @staticmethod
    def get_random_terms(deck_id):
        return Term.objects.get_random_terms(deck_id)

    @staticmethod
    def filter_by_deck(deck_id):
        return Term.objects.filter(deck_id=deck_id)

    @staticmethod
    def find_by_name_in_deck(deck_id, name):
        return Term.objects.filter(deck_id=deck_id, name__iexact=name).first()

    @staticmethod
    def create(deck_id, **fields):
        return Term.objects.create(deck_id=deck_id, **fields)

    @staticmethod
    def bulk_create(deck_id, terms_data):
        terms = [Term(deck_id=deck_id, **term) for term in terms_data]
        return Term.objects.bulk_create(terms)

    @staticmethod
    def update_term(term_id, name, description, image):
        term = Term.objects.filter(id=term_id).first()
        if term:
            term.name = name
            term.description = description
            term.image = image
            term.save()
        return term

    @staticmethod
    def delete(term):
        term.delete()

    @staticmethod
    def get_deck_name(deck_id):
        result = Deck.objects.filter(id=deck_id).values("name").first()
        return result.get("name") if result else None
