//! `/api/terms/*`

use crate::error::AppError;
use crate::infrastructure::persistence::{decks, terms};
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/terms/", get(list_terms).post(create_term))
        .route("/api/terms", get(list_terms).post(create_term))
        .route("/api/terms/search/", get(search_terms))
        .route("/api/terms/search", get(search_terms))
        .route("/api/terms/add_to_default_deck/", post(add_to_default_deck))
        .route("/api/terms/add_to_default_deck", post(add_to_default_deck))
        .route("/api/terms/add_terms/", post(add_terms))
        .route("/api/terms/add_terms", post(add_terms))
        .route("/api/terms/update_terms/", put(update_terms))
        .route("/api/terms/update_terms", put(update_terms))
        .route("/api/terms/:id/", get(get_term).put(update_term).delete(delete_term))
        .route("/api/terms/:id", get(get_term).put(update_term).delete(delete_term))
}

#[derive(Deserialize)]
struct DeckIdQ {
    deck_id: Option<String>,
    #[serde(default)]
    cursor: Option<String>,
}

async fn list_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(_u): AuthUser,
    Query(q): Query<DeckIdQ>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deck_id = q
        .deck_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::BadRequest("deck_id required".into()))?;
    let did = Uuid::parse_str(deck_id).map_err(|_| AppError::BadRequest("bad deck_id".into()))?;
    let rows: Vec<crate::infrastructure::persistence::rows::TermRow> = sqlx::query_as(
        "SELECT id, created_at, updated_at, name, description, image, deck_id FROM backend_term WHERE deck_id = ? ORDER BY created_at DESC",
    )
    .bind(crate::util::db_uuid::to_mysql_char(did))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j: Vec<_> = rows.iter().map(term_nest_json).collect();
    Ok(Json(json!(j)))
}

fn term_nest_json(t: &crate::infrastructure::persistence::rows::TermRow) -> serde_json::Value {
    json!({
        "id": t.id.to_string(),
        "name": t.name,
        "description": t.description,
        "image": t.image,
    })
}

#[derive(Deserialize)]
struct SearchQ {
    deck_id: Option<String>,
    query: Option<String>,
}

async fn search_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(_u): AuthUser,
    Query(q): Query<SearchQ>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = crate::infrastructure::elasticsearch::ElasticsearchClient::new(
        &state.settings,
        state.http.clone(),
    );
    let body = crate::infrastructure::elasticsearch::ElasticsearchClient::term_search_body(
        q.query.as_deref().unwrap_or(""),
        q.deck_id.as_deref(),
    );
    match client.search_raw("terms", body).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => {
            tracing::warn!("es term search: {e}");
            Err(AppError::Anyhow(e))
        }
    }
}

#[derive(Deserialize)]
struct CreateTerm {
    name: String,
    description: Option<String>,
    deck: String,
    image: Option<String>,
}

async fn create_term(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(body): Json<CreateTerm>,
) -> Result<Json<serde_json::Value>, AppError> {
    let deck_id = Uuid::parse_str(&body.deck).map_err(|_| AppError::BadRequest("bad deck".into()))?;
    let deck = decks::find_deck(&state.db.pool, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if !user_can_edit_deck(&state, &u, &deck)
        .await
        .map_err(|e| AppError::Anyhow(e))?
    {
        return Err(AppError::BadRequest("user has no permission.".into()));
    }
    let id = Uuid::new_v4();
    let desc = body.description.unwrap_or_default();
    terms::insert_term(
        &state.db.pool,
        id,
        &body.name,
        &desc,
        body.image.as_deref(),
        deck_id,
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&deck_id, &Uuid::from(u.id))
            .await;
    }
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(term_full_json(&t, deck_id)))
}

async fn user_can_edit_deck(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    d: &crate::infrastructure::persistence::rows::DeckRow,
) -> anyhow::Result<bool> {
    if u.is_superuser {
        return Ok(true);
    }
    if d.owner_id == u.id {
        return Ok(true);
    }
    let r: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM backend_userdeckrole WHERE deck_id = ? AND user_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(d.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_optional(&state.db.pool)
    .await?;
    Ok(matches!(
        r,
        Some((ref role,)) if role == "E"
    ))
}

fn term_full_json(
    t: &crate::infrastructure::persistence::rows::TermRow,
    deck_id: impl Into<Uuid>,
) -> serde_json::Value {
    let deck_id = deck_id.into();
    json!({
        "id": t.id.to_string(),
        "name": t.name,
        "description": t.description,
        "image": t.image,
        "deck": deck_id.to_string(),
    })
}

async fn get_term(
    State(state): State<Arc<AppState>>,
    AuthUser(_u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    Ok(Json(term_full_json(&t, t.deck_id)))
}

#[derive(Deserialize)]
struct UpdateTerm {
    name: Option<String>,
    description: Option<String>,
    image: Option<String>,
}

async fn update_term(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTerm>,
) -> Result<Json<serde_json::Value>, AppError> {
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    let deck = decks::find_deck(&state.db.pool, t.deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    if !user_can_edit_deck(&state, &u, &deck)
        .await
        .map_err(|e| AppError::Anyhow(e))?
    {
        return Err(AppError::Forbidden);
    }
    let name = body.name.as_deref().unwrap_or(&t.name);
    let desc = body.description.as_deref().unwrap_or(&t.description);
    let img = body.image.as_ref().or(t.image.as_ref());
    terms::update_term(
        &state.db.pool,
        id,
        name,
        desc,
        img.map(|s| s.as_str()),
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&Uuid::from(t.deck_id), &Uuid::from(u.id))
            .await;
    }
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(term_full_json(&t, t.deck_id)))
}

async fn delete_term(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    let deck = decks::find_deck(&state.db.pool, t.deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    if !user_can_edit_deck(&state, &u, &deck)
        .await
        .map_err(|e| AppError::Anyhow(e))?
    {
        return Err(AppError::Forbidden);
    }
    terms::delete_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&Uuid::from(t.deck_id), &Uuid::from(u.id))
            .await;
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct AddDefault {
    name: String,
    description: Option<String>,
}

async fn add_to_default_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(mut body): Json<AddDefault>,
) -> Result<Json<serde_json::Value>, AppError> {
    let dd = u.default_deck_id
        .ok_or_else(|| AppError::BadRequest("Please setup your default deck".into()))?;
    let dup: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM backend_term WHERE deck_id = ? AND LOWER(name) = LOWER(?)",
    )
    .bind(crate::util::db_uuid::to_mysql_char(dd))
    .bind(&body.name)
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if dup.0 > 0 {
        return Err(AppError::BadRequest("term is already existed".into()));
    }
    let id = Uuid::new_v4();
    let desc = body.description.take().unwrap_or_default();
    terms::insert_term(
        &state.db.pool,
        id,
        &body.name,
        &desc,
        None,
        dd,
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&Uuid::from(dd), &Uuid::from(u.id))
            .await;
    }
    let t = terms::find_term(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(term_full_json(&t, dd)))
}

#[derive(Deserialize)]
struct AddTerms {
    deck_id: String,
}

async fn add_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(_body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    Err(AppError::BadRequest(
        "add_terms multipart/form: use JSON API with deck_id + terms[] in future".into(),
    ))
}

async fn update_terms(
    State(state): State<Arc<AppState>>,
    AuthUser(_u): AuthUser,
    Json(_body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    Err(AppError::BadRequest("update_terms: form bulk not ported".into()))
}
