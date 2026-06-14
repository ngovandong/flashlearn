use crate::util::db_uuid::MysqlUuid;
use chrono::{NaiveDate, NaiveDateTime};
use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: MysqlUuid,
    pub password: String,
    pub last_login: Option<NaiveDateTime>,
    pub first_name: String,
    pub last_name: String,
    pub is_active: bool,
    pub is_superuser: bool,
    pub name: String,
    pub email: String,
    pub image_url: Option<String>,
    pub is_validated_email: bool,
    pub default_deck_id: Option<MysqlUuid>,
    pub learning_streak_count: i32,
    pub last_study_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DeckRow {
    pub id: MysqlUuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub description: String,
    pub field: String,
    pub is_public: bool,
    pub background: Option<String>,
    pub owner_id: MysqlUuid,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct TermRow {
    pub id: MysqlUuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub meaning: String,
    pub image: Option<String>,
    pub deck_id: MysqlUuid,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct UserLearningProgressRow {
    pub id: MysqlUuid,
    pub user_id: MysqlUuid,
    pub term_id: MysqlUuid,
    pub last_learned_at: NaiveDateTime,
    pub last_revised_at: NaiveDateTime,
    pub score: i32,
    pub is_skip: bool,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct UserDeckRoleRow {
    pub id: MysqlUuid,
    pub user_id: MysqlUuid,
    pub deck_id: MysqlUuid,
    pub role: String,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct FolderRow {
    pub id: MysqlUuid,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub name: String,
    pub description: String,
    pub owner_id: MysqlUuid,
}
