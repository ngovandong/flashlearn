from elasticsearch_dsl import Q


class DeckSearchQuery:
    @staticmethod
    def build(query: str, user) -> Q:
        search_query = Q("bool", should=[])

        search_query.should.append(
            Q(
                "multi_match",
                query=query,
                fields=["owner.email", "name", "description", "owner.name^2.0"],
            )
        )

        user_condition_query = Q(
            "bool",
            should=[
                Q("match", owner__id=user.id),
                Q("term", is_public=True),
                Q("nested", path="users", query=Q("match", **{"users.id": user.id})),
            ],
            minimum_should_match=1,
        )

        if query.strip():
            return search_query & user_condition_query
        return user_condition_query
