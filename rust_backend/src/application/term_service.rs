//! Term revise / random selection (parity with `backend/managers/term.py`).

use crate::infrastructure::persistence::rows::DeckRow;
use crate::util::db_uuid::MysqlUuid;
use crate::state::AppState;
use anyhow::Result;
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct OnlyName {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProgressTerm {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub image: Option<String>,
    pub learning_progress_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct ReviseTermsPayload {
    pub deck_name: String,
    pub all_terms: Vec<OnlyName>,
    pub revise_terms: Vec<ProgressTerm>,
}

pub async fn get_revise_terms_data(
    state: &AppState,
    user_id: impl Into<Uuid>,
    deck_id: impl Into<Uuid>,
) -> Result<ReviseTermsPayload> {
    let user_id = user_id.into();
    let deck_id = deck_id.into();
    let deck: Option<DeckRow> = sqlx::query_as(
        "SELECT id, created_at, updated_at, name, description, field, is_public, background, owner_id FROM backend_deck WHERE id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .fetch_optional(&state.db.pool)
    .await?;

    let deck_name = deck.map(|d| d.name).unwrap_or_default();

    let raw_terms: Vec<(MysqlUuid, String)> = sqlx::query_as(
        "SELECT id, name FROM backend_term WHERE deck_id = ? ORDER BY RAND() LIMIT 50",
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .fetch_all(&state.db.pool)
    .await?;

    let revise_rows: Vec<(MysqlUuid, String, String, Option<String>, MysqlUuid)> = sqlx::query_as(
        r#"SELECT t.id, t.name, t.description, t.image, l.id
           FROM backend_term t
           INNER JOIN backend_userlearningprogress l ON t.id = l.term_id
           WHERE t.deck_id = ? AND l.user_id = ? AND l.is_skip = 0
           ORDER BY (-10.0 * TIMESTAMPDIFF(SECOND, l.last_revised_at, UTC_TIMESTAMP()) / 86400.0) + l.score ASC
           LIMIT 5"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .bind(crate::util::db_uuid::to_mysql_char(user_id))
    .fetch_all(&state.db.pool)
    .await?;

    let all_terms: Vec<OnlyName> = raw_terms
        .into_iter()
        .map(|(id, name)| OnlyName {
            id: id.into(),
            name,
        })
        .collect();

    let revise_terms: Vec<ProgressTerm> = revise_rows
        .into_iter()
        .map(|(id, name, description, image, lp_id)| ProgressTerm {
            id: id.into(),
            name,
            description,
            image,
            learning_progress_id: lp_id.into(),
        })
        .collect();

    Ok(ReviseTermsPayload {
        deck_name,
        all_terms,
        revise_terms,
    })
}

pub fn revise_terms_to_json(p: ReviseTermsPayload) -> serde_json::Value {
    json!({
        "deck_name": p.deck_name,
        "all_terms": p.all_terms,
        "revise_terms": p.revise_terms,
    })
}
