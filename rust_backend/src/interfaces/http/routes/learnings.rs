//! `/api/learnings/*`

use crate::application::{learning_service, term_service};
use crate::error::AppError;
use crate::infrastructure::persistence::{learning, terms};
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/learnings/", post(create_learning))
        .route("/api/learnings", post(create_learning))
        .route("/api/learnings/:id/correct/", put(correct))
        .route("/api/learnings/:id/correct", put(correct))
        .route("/api/learnings/:id/incorrect/", put(incorrect))
        .route("/api/learnings/:id/incorrect", put(incorrect))
        .route("/api/learnings/:id/remember/", put(remember))
        .route("/api/learnings/:id/remember", put(remember))
        .route("/api/learnings/:id/priority/", put(priority))
        .route("/api/learnings/:id/priority", put(priority))
        .route("/api/learnings/get_learning_terms/", get(get_learning_terms))
        .route("/api/learnings/get_learning_terms", get(get_learning_terms))
        .route(
            "/api/learnings/get_latest_learned_term/",
            get(get_latest_learned_term),
        )
        .route(
            "/api/learnings/get_latest_learned_term",
            get(get_latest_learned_term),
        )
        .route("/api/learnings/get_revise_terms/", get(get_revise_terms))
        .route("/api/learnings/get_revise_terms", get(get_revise_terms))
}

#[derive(Deserialize)]
struct CreateLp {
    term_id: String,
    user_id: String,
}

async fn create_learning(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(mut body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    body["user_id"] = json!(u.id.to_string());
    let term_id = body
        .get("term_id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| AppError::BadRequest("term_id required".into()))?;
    let tid = Uuid::parse_str(term_id).map_err(|_| AppError::BadRequest("bad term_id".into()))?;
    let existing = learning::find_progress_by_user_term(&state.db.pool, u.id, tid)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    if existing.is_none() {
        let id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO backend_userlearningprogress (id, user_id, term_id, last_learned_at, last_revised_at, score, is_skip) \
             VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), 0, 0)",
        )
        .bind(crate::util::db_uuid::to_mysql_char(id))
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .bind(crate::util::db_uuid::to_mysql_char(tid))
        .execute(&state.db.pool)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    } else {
        sqlx::query(
            "UPDATE backend_userlearningprogress SET last_learned_at = CURRENT_TIMESTAMP(6) WHERE user_id = ? AND term_id = ?",
        )
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .bind(crate::util::db_uuid::to_mysql_char(tid))
        .execute(&state.db.pool)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    }
    let t = terms::find_term(&state.db.pool, tid)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&uuid::Uuid::from(t.deck_id), &uuid::Uuid::from(u.id))
            .await;
    }
    learning_service::record_study_activity(&state, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(Json(json!({"status": "ok"})))
}

async fn correct(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let lp = learning::find_progress(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if lp.user_id != u.id {
        return Err(AppError::Forbidden);
    }
    sqlx::query(
        "UPDATE backend_userlearningprogress SET score = score + 2, last_revised_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(id))
    .execute(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let t = terms::find_term(&state.db.pool, lp.term_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&uuid::Uuid::from(t.deck_id), &uuid::Uuid::from(u.id))
            .await;
    }
    learning_service::record_study_activity(&state, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::OK)
}

async fn incorrect(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let lp = learning::find_progress(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if lp.user_id != u.id {
        return Err(AppError::Forbidden);
    }
    sqlx::query(
        "UPDATE backend_userlearningprogress SET score = score - 3, last_revised_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(id))
    .execute(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let t = terms::find_term(&state.db.pool, lp.term_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&uuid::Uuid::from(t.deck_id), &uuid::Uuid::from(u.id))
            .await;
    }
    learning_service::record_study_activity(&state, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::OK)
}

async fn remember(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let lp = learning::find_progress(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if lp.user_id != u.id {
        return Err(AppError::Forbidden);
    }
    sqlx::query(
        "UPDATE backend_userlearningprogress SET is_skip = NOT is_skip WHERE id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(id))
    .execute(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::OK)
}

#[derive(Deserialize)]
struct PriorityBody {
    adjust_point: Option<i32>,
}

async fn priority(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<PriorityBody>,
) -> Result<axum::http::StatusCode, AppError> {
    let adj = body.adjust_point.unwrap_or(0);
    if adj == 0 {
        return Ok(axum::http::StatusCode::OK);
    }
    let lp = learning::find_progress(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if lp.user_id != u.id {
        return Err(AppError::Forbidden);
    }
    sqlx::query("UPDATE backend_userlearningprogress SET score = score + ? WHERE id = ?")
        .bind(adj)
        .bind(crate::util::db_uuid::to_mysql_char(id))
        .execute(&state.db.pool)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::OK)
}

#[derive(Deserialize)]
struct DeckIdP {
    deck_id: Option<String>,
}

async fn get_learning_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<DeckIdP>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deck_id = q
        .deck_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("deck_id required".into()))?;
    let did = Uuid::parse_str(deck_id).map_err(|_| AppError::BadRequest("bad deck_id".into()))?;
    let rows: Vec<crate::infrastructure::persistence::rows::TermRow> = sqlx::query_as(
        r#"SELECT t.id, t.created_at, t.updated_at, t.name, t.description, t.image, t.deck_id
           FROM backend_term t
           INNER JOIN backend_userlearningprogress l ON l.term_id = t.id
           WHERE t.deck_id = ? AND l.user_id = ? AND l.is_skip = 0 AND l.score < 5"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(did))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j: Vec<_> = rows
        .iter()
        .map(|t| {
            json!({
                "id": t.id.to_string(),
                "name": t.name,
                "description": t.description,
                "image": t.image,
                "deck": t.deck_id.to_string(),
            })
        })
        .collect();
    Ok(Json(json!(j)))
}

async fn get_latest_learned_term(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<DeckIdP>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deck_id = q
        .deck_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("deck_id required".into()))?;
    let did = Uuid::parse_str(deck_id).map_err(|_| AppError::BadRequest("bad deck_id".into()))?;
    let deck_terms: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM backend_term WHERE deck_id = ? ORDER BY created_at ASC",
    )
    .bind(crate::util::db_uuid::to_mysql_char(did))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let last: Option<Uuid> = sqlx::query_scalar(
        r#"SELECT t.id FROM backend_term t
           INNER JOIN backend_userlearningprogress l ON l.term_id = t.id
           WHERE t.deck_id = ? AND l.user_id = ?
           ORDER BY l.last_learned_at DESC LIMIT 1"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(did))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(lid) = last {
        let last_learned_index = deck_terms.iter().position(|x| *x == lid).unwrap_or(0);
        let page_size = state.settings.rest_page_size.max(1) as usize;
        let default_page = last_learned_index / page_size + 1;
        return Ok(Json(json!({
            "default_page": default_page,
            "latest_id": lid.to_string(),
            "last_learned_index": last_learned_index,
        })));
    }
    Ok(Json(json!({
        "default_page": 1,
        "latest_id": "",
        "last_learned_index": 0,
    })))
}

async fn get_revise_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<DeckIdP>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deck_id = q
        .deck_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("deck_id required".into()))?;
    let did = Uuid::parse_str(deck_id).map_err(|_| AppError::BadRequest("bad deck_id".into()))?;
    let p = term_service::get_revise_terms_data(&state, u.id, did)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(term_service::revise_terms_to_json(p)))
}
