"""Public read API exposed to other bounded contexts."""


class TermContextApi:
    def __init__(self, term_repo):
        self._term_repo = term_repo

    def get_by_id(self, term_id):
        return self._term_repo.get_by_id(term_id)

    def get_latest_learned_term_info(self, user, deck_id, page_size=10):
        return self._term_repo.get_latest_learned_term_info(user, deck_id, page_size)
