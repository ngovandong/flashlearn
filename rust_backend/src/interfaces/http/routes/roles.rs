//! `/api/roles/*`

use crate::auth::jwt::verify_invite_token;
use crate::error::AppError;
use crate::infrastructure::persistence::{decks, roles as role_repo};
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/roles/:id/update_role/", put(update_role))
        .route("/api/roles/:id/update_role", put(update_role))
        .route("/api/roles/invite/", get(invite))
        .route("/api/roles/invite", get(invite))
}

#[derive(Deserialize)]
struct UpdateRole {
    role: String,
}

async fn update_role(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRole>,
) -> Result<Json<serde_json::Value>, AppError> {
    let role = role_repo::find_role(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    let deck = decks::find_deck(&state.db.pool, role.deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if deck.owner_id != u.id {
        return Err(AppError::Forbidden);
    }
    role_repo::update_role_field(&state.db.pool, id, &body.role)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let role = role_repo::find_role(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    let email: (String,) = sqlx::query_as("SELECT email FROM backend_user WHERE id = ?")
        .bind(crate::util::db_uuid::to_mysql_char(role.user_id))
        .fetch_one(&state.db.pool)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(Json(json!({
        "id": role.id.to_string(),
        "email": email.0,
        "role": role.role,
        "streaks": role.streaks,
    })))
}

#[derive(Deserialize)]
struct InviteQ {
    token: Option<String>,
}

async fn invite(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<InviteQ>,
) -> Result<Json<serde_json::Value>, AppError> {
    let token = q.token.ok_or_else(|| AppError::BadRequest("token is required".into()))?;
    let claims = verify_invite_token(&state.settings, &token).map_err(|_| {
        AppError::BadRequest("Invalid token".into())
    })?;
    let deck = decks::find_deck(&state.db.pool, claims.deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::BadRequest("deck not found".into()))?;
    let in_deck: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM backend_userdeckrole WHERE deck_id = ? AND user_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let is_owner = deck.owner_id == u.id;
    if in_deck.0 == 0 && !is_owner {
        role_repo::insert_role(
            &state.db.pool,
            Uuid::new_v4(),
            u.id,
            deck.id,
            &claims.role,
        )
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    }
    Ok(Json(json!({"deck_id": deck.id.to_string()})))
}
