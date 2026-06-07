from elasticsearch_dsl import Q


class TermSearchQuery:
    @staticmethod
    def build(query: str, deck_id: str | None = None) -> Q:
        search_query = Q("bool", should=[])
        if deck_id:
            search_query.should.append(Q("match", deck_id=deck_id))
        if query.strip():
            search_query.should.append(Q("multi_match", query=query, fields=["name", "description", "deck.name"]))
        return search_query
