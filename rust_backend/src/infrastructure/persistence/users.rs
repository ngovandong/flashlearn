use super::UserRow;
use crate::util::db_uuid::to_mysql_char;
use anyhow::Result;
use chrono::Utc;
use chrono_tz::Tz;
use sqlx::MySqlPool;
use uuid::Uuid;

const USER_SELECT: &str = "SELECT id, password, last_login, first_name, last_name, is_active, is_superuser, \
    name, email, image_url, is_validated_email, default_deck_id, learning_streak_count, last_study_date \
    FROM backend_user";

pub async fn find_user_by_email(pool: &MySqlPool, email: &str) -> Result<Option<UserRow>> {
    let row = sqlx::query_as::<_, UserRow>(&format!("{USER_SELECT} WHERE email = ?"))
    .bind(email)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn find_user_by_id(pool: &MySqlPool, id: impl Into<Uuid>) -> Result<Option<UserRow>> {
    let id = id.into();
    let row = sqlx::query_as::<_, UserRow>(&format!("{USER_SELECT} WHERE id = ?"))
    .bind(to_mysql_char(id))
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn insert_user(
    pool: &MySqlPool,
    id: Uuid,
    password_hash: &str,
    name: &str,
    email: &str,
    first_name: &str,
    last_name: &str,
    image_url: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO backend_user (id, password, last_login, first_name, last_name, is_active, is_superuser, \
         name, email, image_url, is_validated_email, default_deck_id, learning_streak_count, last_study_date) \
         VALUES (?, ?, NULL, ?, ?, 1, 0, ?, ?, ?, 0, NULL, 0, NULL)",
    )
    .bind(to_mysql_char(id))
    .bind(password_hash)
    .bind(first_name)
    .bind(last_name)
    .bind(name)
    .bind(email)
    .bind(image_url)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_user_password(pool: &MySqlPool, user_id: impl Into<Uuid>, password_hash: &str) -> Result<()> {
    let user_id = user_id.into();
    sqlx::query("UPDATE backend_user SET password = ? WHERE id = ?")
        .bind(password_hash)
        .bind(to_mysql_char(user_id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_user_validated(pool: &MySqlPool, user_id: impl Into<Uuid>) -> Result<()> {
    let user_id = user_id.into();
    sqlx::query("UPDATE backend_user SET is_validated_email = 1 WHERE id = ?")
        .bind(to_mysql_char(user_id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_default_deck(
    pool: &MySqlPool,
    user_id: impl Into<Uuid>,
    deck_id: Option<Uuid>,
) -> Result<()> {
    let user_id = user_id.into();
    sqlx::query("UPDATE backend_user SET default_deck_id = ? WHERE id = ?")
        .bind(deck_id.map(to_mysql_char))
        .bind(to_mysql_char(user_id))
        .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_default_deck_for_deck(pool: &MySqlPool, deck_id: impl Into<Uuid>) -> Result<()> {
    let deck_id = deck_id.into();
    sqlx::query("UPDATE backend_user SET default_deck_id = NULL WHERE default_deck_id = ?")
        .bind(to_mysql_char(deck_id))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn record_study_activity(pool: &MySqlPool, user_id: Uuid, tz: Tz) -> Result<()> {
    let user = find_user_by_id(pool, user_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("user not found"))?;
    let today = Utc::now().with_timezone(&tz).date_naive();
    if user.last_study_date == Some(today) {
        return Ok(());
    }

    let yesterday = today.pred_opt().unwrap_or(today);
    let new_streak = if user.last_study_date == Some(yesterday) {
        user.learning_streak_count + 1
    } else {
        1
    };

    sqlx::query(
        "UPDATE backend_user SET learning_streak_count = ?, last_study_date = ? WHERE id = ?",
    )
    .bind(new_streak)
    .bind(today)
    .bind(to_mysql_char(user_id))
    .execute(pool)
    .await?;
    Ok(())
}
