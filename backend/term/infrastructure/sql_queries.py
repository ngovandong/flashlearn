from types import SimpleNamespace

from sqlalchemy import and_, func, literal_column, select

from backend.models import Term, UserLearningProgress
from backend.shared.infrastructure.sqlalchemy.engine import get_connection
from backend.shared.infrastructure.sqlalchemy.utils import as_uuid, normalize_uuid

_MICROSECONDS_PER_DAY = 1_000_000 * 60 * 60 * 24


def fetch_revise_terms(user_id, deck_id, limit: int = 5) -> list[SimpleNamespace]:
    user_id = normalize_uuid(user_id)
    deck_id = normalize_uuid(deck_id)

    term = Term.sa_table
    progress = UserLearningProgress.sa_table

    rank_expr = (
        func.timestampdiff(
            literal_column("MICROSECOND"),
            progress.c.last_revised_at,
            func.now(),
        )
        / _MICROSECONDS_PER_DAY
        * -10
        + progress.c.score
    ).label("rank")

    stmt = (
        select(
            term.c.id,
            term.c.name,
            term.c.meaning,
            term.c.image,
            progress.c.id.label("learning_progress_id"),
            progress.c.total_revisions,
            rank_expr,
        )
        .select_from(term.join(progress, term.c.id == progress.c.term_id))
        .where(
            and_(
                term.c.deck_id == deck_id,
                progress.c.user_id == user_id,
                progress.c.is_skip.is_(False),
            )
        )
        .order_by(rank_expr)
        .limit(limit)
    )

    with get_connection() as conn:
        rows = conn.execute(stmt).mappings().all()

    return [
        SimpleNamespace(
            id=as_uuid(row["id"]),
            name=row["name"],
            meaning=row["meaning"],
            image=row["image"],
            learning_progress_id=as_uuid(row["learning_progress_id"]),
            total_revisions=row["total_revisions"],
        )
        for row in rows
    ]


def fetch_latest_learned_term_info(user_id, deck_id, page_size: int = 10, term_id=None) -> dict:
    user_id = normalize_uuid(user_id)
    deck_id = normalize_uuid(deck_id)
    term = Term.sa_table
    progress = UserLearningProgress.sa_table

    term_index = (func.row_number().over(order_by=(term.c.created_at.desc(), term.c.name)) - 1).label("term_index")
    ordered_terms = select(term.c.id, term_index).where(term.c.deck_id == deck_id).cte("ordered_terms")

    if term_id:
        # Deep-link target: open the deck at a specific term instead of the
        # user's last-learned position.
        target_id = normalize_uuid(term_id)
        stmt = select(
            ordered_terms.c.id.label("latest_id"),
            ordered_terms.c.term_index.label("last_learned_index"),
        ).where(ordered_terms.c.id == target_id)
    else:
        last_learned = (
            select(term.c.id)
            .select_from(term.join(progress, term.c.id == progress.c.term_id))
            .where(and_(term.c.deck_id == deck_id, progress.c.user_id == user_id))
            .order_by(progress.c.last_learned_at.desc())
            .limit(1)
            .cte("last_learned")
        )

        stmt = select(
            last_learned.c.id.label("latest_id"),
            ordered_terms.c.term_index.label("last_learned_index"),
        ).select_from(last_learned.join(ordered_terms, last_learned.c.id == ordered_terms.c.id))

    with get_connection() as conn:
        row = conn.execute(stmt).mappings().first()

    if row is None:
        return {"default_page": 1, "latest_id": "", "last_learned_index": 0}

    last_learned_index = int(row["last_learned_index"])
    return {
        "default_page": last_learned_index // page_size + 1,
        "latest_id": as_uuid(row["latest_id"]),
        "last_learned_index": last_learned_index,
    }
