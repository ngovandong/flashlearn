//! Axum extractors (`AuthUser`, optional token).

use crate::auth::jwt::verify_access_token;
use crate::error::AppError;
use crate::infrastructure::persistence::users;
use crate::infrastructure::persistence::rows::UserRow;
use crate::state::AppState;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::HeaderMap;
use std::sync::Arc;

pub struct AuthUser(pub UserRow);

#[async_trait::async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let user = authenticate(&parts.headers, state).await?;
        Ok(AuthUser(user))
    }
}

pub async fn authenticate(headers: &HeaderMap, state: &Arc<AppState>) -> Result<UserRow, AppError> {
    let auth = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("missing Authorization".into()))?;
    let token = auth
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("invalid Authorization scheme".into()))?;
    let claims = verify_access_token(&state.settings, token).map_err(|_| {
        AppError::Unauthorized("invalid token".into())
    })?;
    let uid_str = claims
        .user_id
        .as_str()
        .ok_or_else(|| AppError::Unauthorized("bad user_id claim".into()))?;
    let user_id = uuid::Uuid::parse_str(uid_str)
        .map_err(|_| AppError::Unauthorized("bad user_id".into()))?;

    // Always load from DB so `password` and flags stay correct (Django cached ORM instances; we skip pickle).
    let u = users::find_user_by_id(&state.db.pool, user_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("user not found".into()))?;

    if !u.is_active {
        return Err(AppError::Unauthorized("user inactive".into()));
    }

    if let Some(redis) = &state.redis {
        let j = user_to_json_value(&u);
        let _ = redis.cache_user_json(&user_id, &j).await;
    }

    Ok(u)
}

fn user_to_json_value(u: &UserRow) -> serde_json::Value {
    serde_json::json!({
        "id": u.id.to_string(),
        "email": u.email,
        "name": u.name,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "image_url": u.image_url,
        "default_deck": u.default_deck_id.map(|d| d.to_string()),
    })
}
