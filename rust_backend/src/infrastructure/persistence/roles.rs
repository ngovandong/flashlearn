use super::UserDeckRoleRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use sqlx::MySqlPool;
use uuid::Uuid;

pub async fn find_role(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<UserDeckRoleRow>> {
    let id = id.into();
    sqlx::query_as::<_, UserDeckRoleRow>(
        "SELECT id, user_id, deck_id, role FROM backend_userdeckrole WHERE id = ?",
    )
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn insert_role(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    user_id: impl Into<Uuid>,
    deck_id: impl Into<Uuid>,
    role: &str,
) -> Result<()> {
    let id = id.into();
    let user_id = user_id.into();
    let deck_id = deck_id.into();
    sqlx::query(
        "INSERT INTO backend_userdeckrole (id, user_id, deck_id, role) VALUES (?, ?, ?, ?)",
    )
    .bind(to_mysql_char(id))
    .bind(to_mysql_char(user_id))
    .bind(to_mysql_char(deck_id))
    .bind(role)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_role_field(pool: &MySqlPool, id: impl Into<Uuid>, role: &str) -> Result<()> {
    let id = id.into();
    sqlx::query("UPDATE backend_userdeckrole SET role = ? WHERE id = ?")
        .bind(role)
        .bind(to_mysql_char(id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_role(
    pool: &MySqlPool,
    user_id: impl Into<Uuid>,
    deck_id: impl Into<Uuid>,
) -> Result<()> {
    let user_id = user_id.into();
    let deck_id = deck_id.into();
    sqlx::query("DELETE FROM backend_userdeckrole WHERE user_id = ? AND deck_id = ?")
        .bind(to_mysql_char(user_id))
        .bind(to_mysql_char(deck_id))
        .execute(pool)
        .await?;
    Ok(())
}
