use super::DeckRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use sqlx::MySqlPool;
use uuid::Uuid;

pub async fn find_deck(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<DeckRow>> {
    let id = id.into();
    sqlx::query_as::<_, DeckRow>(
        "SELECT id, created_at, updated_at, name, description, field, is_public, background, owner_id \
         FROM backend_deck WHERE id = ?",
    )
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn insert_deck(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: &str,
    description: &str,
    field: &str,
    is_public: bool,
    background: Option<&str>,
    owner_id: impl Into<Uuid>,
) -> Result<()> {
    let id = id.into();
    let owner_id = owner_id.into();
    sqlx::query(
        "INSERT INTO backend_deck (id, created_at, updated_at, name, description, field, is_public, background, owner_id) \
         VALUES (?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?, ?, ?, ?, ?)",
    )
    .bind(to_mysql_char(id))
    .bind(name)
    .bind(description)
    .bind(field)
    .bind(is_public as i8)
    .bind(background)
    .bind(to_mysql_char(owner_id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_deck_touch(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<()> {
    let id = id.into();
    sqlx::query("UPDATE backend_deck SET updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?")
        .bind(to_mysql_char(id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_deck_fields(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: Option<&str>,
    description: Option<&str>,
    is_public: Option<bool>,
    field: Option<&str>,
    background: Option<&str>,
) -> Result<()> {
    let id = id.into();
    sqlx::query(
        "UPDATE backend_deck SET \
         name = COALESCE(?, name), \
         description = COALESCE(?, description), \
         is_public = COALESCE(?, is_public), \
         field = COALESCE(?, field), \
         background = COALESCE(?, background), \
         updated_at = CURRENT_TIMESTAMP(6) \
         WHERE id = ?",
    )
    .bind(name)
    .bind(description)
    .bind(is_public.map(|b| b as i8))
    .bind(field)
    .bind(background)
    .bind(to_mysql_char(id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_deck(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<()> {
    let id = id.into();
    sqlx::query("DELETE FROM backend_deck WHERE id = ?")
        .bind(to_mysql_char(id))
        .execute(pool)
        .await?;
    Ok(())
}
