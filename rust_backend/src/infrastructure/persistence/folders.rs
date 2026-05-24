use super::FolderRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use sqlx::MySqlPool;
use uuid::Uuid;

pub async fn find_folder(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<FolderRow>> {
    let id = id.into();
    sqlx::query_as::<_, FolderRow>(
        "SELECT id, created_at, updated_at, name, description, owner_id FROM backend_folder WHERE id = ?",
    )
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

pub async fn list_folders_by_owner(pool: &MySqlPool, owner_id: impl Into<Uuid>) -> Result<Vec<FolderRow>> {
    let owner_id = owner_id.into();
    sqlx::query_as::<_, FolderRow>(
        "SELECT id, created_at, updated_at, name, description, owner_id FROM backend_folder WHERE owner_id = ? ORDER BY created_at DESC",
    )
    .bind(to_mysql_char(owner_id))
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn insert_folder(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: &str,
    description: &str,
    owner_id: impl Into<Uuid>,
) -> Result<()> {
    let id = id.into();
    let owner_id = owner_id.into();
    sqlx::query(
        "INSERT INTO backend_folder (id, created_at, updated_at, name, description, owner_id) \
         VALUES (?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?, ?)",
    )
    .bind(to_mysql_char(id))
    .bind(name)
    .bind(description)
    .bind(to_mysql_char(owner_id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_folder(
    pool: &MySqlPool,
    id: impl Into<Uuid>,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<()> {
    let id = id.into();
    sqlx::query(
        "UPDATE backend_folder SET \
         name = COALESCE(?, name), \
         description = COALESCE(?, description), \
         updated_at = CURRENT_TIMESTAMP(6) \
         WHERE id = ?",
    )
    .bind(name)
    .bind(description)
    .bind(to_mysql_char(id))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_folder(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<()> {
    let id = id.into();
    sqlx::query("DELETE FROM backend_folder WHERE id = ?")
        .bind(to_mysql_char(id))
        .execute(pool)
        .await?;
    Ok(())
}
