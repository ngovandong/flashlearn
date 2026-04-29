//! `/api/folders/*`

use crate::error::AppError;
use crate::infrastructure::persistence::folders;
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Path, State};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/folders/", get(list_folders).post(create_folder))
        .route("/api/folders", get(list_folders).post(create_folder))
        .route("/api/folders/:id/", get(get_folder).put(update_folder).delete(delete_folder))
        .route("/api/folders/:id", get(get_folder).put(update_folder).delete(delete_folder))
}

async fn list_folders(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = folders::list_folders_by_owner(&state.db.pool, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let j: Vec<_> = rows
        .iter()
        .map(|f| {
            json!({
                "id": f.id.to_string(),
                "name": f.name,
                "description": f.description,
                "owner": u.id.to_string(),
                "created_at": f.created_at,
                "updated_at": f.updated_at,
            })
        })
        .collect();
    Ok(Json(json!(j)))
}

#[derive(Deserialize)]
struct FolderBody {
    name: String,
    description: String,
}

async fn create_folder(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(body): Json<FolderBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = Uuid::new_v4();
    folders::insert_folder(&state.db.pool, id, &body.name, &body.description, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let f = folders::find_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(json!({
        "id": f.id.to_string(),
        "name": f.name,
        "description": f.description,
        "owner": u.id.to_string(),
        "created_at": f.created_at,
        "updated_at": f.updated_at,
    })))
}

async fn get_folder(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let f = folders::find_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if f.owner_id != u.id {
        return Err(AppError::Forbidden);
    }
    Ok(Json(json!({
        "id": f.id.to_string(),
        "name": f.name,
        "description": f.description,
        "owner": f.owner_id.to_string(),
        "created_at": f.created_at,
        "updated_at": f.updated_at,
    })))
}

#[derive(Deserialize)]
struct UpdateFolder {
    name: Option<String>,
    description: Option<String>,
}

async fn update_folder(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFolder>,
) -> Result<Json<serde_json::Value>, AppError> {
    let f = folders::find_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if f.owner_id != u.id {
        return Err(AppError::Forbidden);
    }
    folders::update_folder(
        &state.db.pool,
        id,
        body.name.as_deref(),
        body.description.as_deref(),
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let f = folders::find_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(json!({
        "id": f.id.to_string(),
        "name": f.name,
        "description": f.description,
        "owner": f.owner_id.to_string(),
        "created_at": f.created_at,
        "updated_at": f.updated_at,
    })))
}

async fn delete_folder(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let f = folders::find_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if f.owner_id != u.id {
        return Err(AppError::Forbidden);
    }
    folders::delete_folder(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
