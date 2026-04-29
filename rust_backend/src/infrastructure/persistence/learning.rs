use super::UserLearningProgressRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use sqlx::MySqlPool;
use uuid::Uuid;

pub async fn find_progress(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<UserLearningProgressRow>> {
    let id = id.into();
    sqlx::query_as::<_, UserLearningProgressRow>(
        "SELECT id, user_id, term_id, last_learned_at, last_revised_at, score, is_skip \
         FROM backend_userlearningprogress WHERE id = ?",
    )
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn find_progress_by_user_term(
    pool: &MySqlPool,
    user_id: impl Into<Uuid>,
    term_id: impl Into<Uuid>,
) -> Result<Option<UserLearningProgressRow>> {
    let user_id = user_id.into();
    let term_id = term_id.into();
    sqlx::query_as::<_, UserLearningProgressRow>(
        "SELECT id, user_id, term_id, last_learned_at, last_revised_at, score, is_skip \
         FROM backend_userlearningprogress WHERE user_id = ? AND term_id = ?",
    )
    .bind(to_mysql_char(user_id))
    .bind(to_mysql_char(term_id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn delete_progress_for_user_deck(
    pool: &MySqlPool,
    user_id: impl Into<Uuid>,
    deck_id: impl Into<Uuid>,
) -> Result<()> {
    let user_id = user_id.into();
    let deck_id = deck_id.into();
    sqlx::query(
        "DELETE FROM backend_userlearningprogress WHERE user_id = ? \
         AND term_id IN (SELECT id FROM backend_term WHERE deck_id = ?)",
    )
    .bind(to_mysql_char(user_id))
    .bind(to_mysql_char(deck_id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_progress_by_deck_user(
    pool: &MySqlPool,
    deck_id: impl Into<Uuid>,
    user_id: impl Into<Uuid>,
) -> Result<()> {
    delete_progress_for_user_deck(pool, user_id, deck_id).await
}
