from sqlalchemy import desc, func, select, union

from backend.models import Deck, Term, UserDeckRole
from backend.shared.infrastructure.sqlalchemy.engine import get_connection
from backend.shared.infrastructure.sqlalchemy.utils import normalize_uuid


def fetch_member_deck_ids(user_id) -> list[str]:
    user_id = normalize_uuid(user_id)
    role = UserDeckRole.sa_table
    stmt = select(role.c.deck_id).where(role.c.user_id == user_id)
    with get_connection() as conn:
        return [row[0] for row in conn.execute(stmt).all()]


def fetch_owned_deck_ids(user_id) -> list[str]:
    user_id = normalize_uuid(user_id)
    deck = Deck.sa_table
    stmt = select(deck.c.id).where(deck.c.owner_id == user_id)
    with get_connection() as conn:
        return [row[0] for row in conn.execute(stmt).all()]


def fetch_user_deck_ids(user_id) -> list[str]:
    user_id = normalize_uuid(user_id)
    deck = Deck.sa_table
    role = UserDeckRole.sa_table
    owned = select(deck.c.id.label("deck_id")).where(deck.c.owner_id == user_id)
    member = select(role.c.deck_id).where(role.c.user_id == user_id)
    stmt = union(owned, member)
    with get_connection() as conn:
        return [row[0] for row in conn.execute(stmt).all()]


def fetch_top_public_deck_ids(user_id, limit: int = 5) -> list[str]:
    user_id = normalize_uuid(user_id)
    excluded_ids = fetch_user_deck_ids(user_id)

    deck = Deck.sa_table
    term = Term.sa_table
    term_count = func.count(term.c.id.distinct()).label("number_of_term")
    stmt = (
        select(deck.c.id, term_count)
        .select_from(deck.outerjoin(term, term.c.deck_id == deck.c.id))
        .where(deck.c.is_public.is_(True))
        .group_by(deck.c.id)
        .order_by(desc(term_count))
        .limit(limit)
    )
    if excluded_ids:
        stmt = stmt.where(deck.c.id.not_in(excluded_ids))

    with get_connection() as conn:
        return [row[0] for row in conn.execute(stmt).all()]
