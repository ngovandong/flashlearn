use super::TermRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use sqlx::MySqlPool;
use uuid::Uuid;

pub async fn find_term(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<TermRow>> {
    let id = id.into();
    sqlx::query_as::<_, TermRow>(
        "SELECT id, created_at, updated_at, name, description, image, deck_id FROM backend_term WHERE id = ?",
    )
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn delete_term(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<()> {
    let id = id.into();
    sqlx::query("DELETE FROM backend_term WHERE id = ?")
        .bind(to_mysql_char(id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_term(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: &str,
    description: &str,
    image: Option<&str>,
    deck_id: impl Into<Uuid>,
) -> Result<()> {
    let id = id.into();
    let deck_id = deck_id.into();
    sqlx::query(
        "INSERT INTO backend_term (id, created_at, updated_at, name, description, image, deck_id) \
         VALUES (?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?, ?, ?)",
    )
    .bind(to_mysql_char(id))
    .bind(name)
    .bind(description)
    .bind(image)
    .bind(to_mysql_char(deck_id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_term(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: &str,
    description: &str,
    image: Option<&str>,
) -> Result<()> {
    let id = id.into();
    sqlx::query(
        "UPDATE backend_term SET name = ?, description = ?, image = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
    )
    .bind(name)
    .bind(description)
    .bind(image)
    .bind(to_mysql_char(id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn count_terms_in_deck(pool: &MySqlPool, deck_id: impl Into<Uuid>) -> Result<i64> {
    let deck_id = deck_id.into();
    let c: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM backend_term WHERE deck_id = ?")
        .bind(to_mysql_char(deck_id))
        .fetch_one(pool)
        .await?;
    Ok(c.0)
}
