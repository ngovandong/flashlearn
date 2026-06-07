from datetime import date

from sqlalchemy import and_, case, func, select

from backend.models import Term, UserLearningProgress
from backend.shared.infrastructure.sqlalchemy.engine import get_connection
from backend.shared.infrastructure.sqlalchemy.utils import normalize_uuid


def fetch_learning_progress_stats(user_id, deck_id, today: date) -> tuple[int, dict]:
    user_id = normalize_uuid(user_id)
    deck_id = normalize_uuid(deck_id)

    term = Term.sa_table
    progress = UserLearningProgress.sa_table

    join = term.join(progress, term.c.id == progress.c.term_id)

    stats_stmt = (
        select(
            func.count().label("total_learned"),
            func.sum(case((progress.c.score > 5, 1), else_=0)).label("completed"),
            func.sum(
                case(
                    (
                        (func.date(progress.c.last_revised_at) == today)
                        | (func.date(progress.c.last_learned_at) == today),
                        1,
                    ),
                    else_=0,
                )
            ).label("learned_today"),
        )
        .select_from(join)
        .where(
            and_(
                progress.c.user_id == user_id,
                term.c.deck_id == deck_id,
            )
        )
    )

    deck_term_stmt = select(func.count()).select_from(term).where(term.c.deck_id == deck_id)

    with get_connection() as conn:
        stats = conn.execute(stats_stmt).mappings().one()
        deck_term = conn.execute(deck_term_stmt).scalar_one()

    total_learned = stats["total_learned"] or 0
    completed = int(stats["completed"] or 0)
    learned_today = int(stats["learned_today"] or 0)
    left = deck_term - total_learned

    return deck_term, {
        "learning": total_learned - completed,
        "completed": completed,
        "left": left,
        "learned_today": learned_today,
    }
