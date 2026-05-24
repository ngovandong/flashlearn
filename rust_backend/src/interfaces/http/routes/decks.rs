//! `/api/decks/*` — deck CRUD and actions.

use crate::application::{deck_service, learning_service};
use crate::domain::roles::FullRole;
use crate::error::AppError;
use crate::infrastructure::elasticsearch::ElasticsearchClient;
use crate::infrastructure::persistence::decks;
use crate::infrastructure::persistence::roles as role_repo;
use crate::infrastructure::persistence::users;
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::routing::{get, post, put};
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/decks/", get(list_decks).post(create_deck))
        .route("/api/decks", get(list_decks).post(create_deck))
        .route("/api/decks/search/", get(search_decks))
        .route("/api/decks/search", get(search_decks))
        .route("/api/decks/my_own_decks/", get(my_own_decks))
        .route("/api/decks/my_own_decks", get(my_own_decks))
        .route("/api/decks/others_deck/", get(others_deck))
        .route("/api/decks/others_deck", get(others_deck))
        .route("/api/decks/latest_decks/", get(latest_decks))
        .route("/api/decks/latest_decks", get(latest_decks))
        .route("/api/decks/my_decks/", get(my_decks))
        .route("/api/decks/my_decks", get(my_decks))
        .route("/api/decks/public_decks/", get(public_decks))
        .route("/api/decks/public_decks", get(public_decks))
        .route("/api/decks/:id/", get(get_deck).put(update_deck).delete(delete_deck))
        .route("/api/decks/:id", get(get_deck).put(update_deck).delete(delete_deck))
        .route(
            "/api/decks/:id/add_user_to_deck/",
            post(add_user_to_deck),
        )
        .route("/api/decks/:id/add_user_to_deck", post(add_user_to_deck))
        .route(
            "/api/decks/:id/remove_user_from_deck/",
            post(remove_user_from_deck),
        )
        .route(
            "/api/decks/:id/remove_user_from_deck",
            post(remove_user_from_deck),
        )
        .route(
            "/api/decks/:id/get_invite_url/",
            post(get_invite_url_handler),
        )
        .route("/api/decks/:id/get_invite_url", post(get_invite_url_handler))
        .route(
            "/api/decks/:id/clear_learning_process/",
            put(clear_learning_process),
        )
        .route("/api/decks/:id/clear_learning_process", put(clear_learning_process))
        .route("/api/decks/:id/join_deck/", post(join_deck))
        .route("/api/decks/:id/join_deck", post(join_deck))
        .route("/api/decks/:id/leave_deck/", post(leave_deck))
        .route("/api/decks/:id/leave_deck", post(leave_deck))
        .route("/api/decks/:id/set_default_deck/", put(set_default_deck))
        .route("/api/decks/:id/set_default_deck", put(set_default_deck))
        .route("/api/decks/:id/clone/", get(clone_deck))
        .route("/api/decks/:id/clone", get(clone_deck))
}

#[derive(Deserialize)]
struct ListQ {
    search: Option<String>,
}

async fn list_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<ListQ>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = deck_list_query(&state, &u, q.search.as_deref()).await?;
    Ok(Json(json!(rows)))
}

async fn deck_list_query(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    search_query: Option<&str>,
) -> anyhow::Result<Vec<serde_json::Value>> {
    let pool = &state.db.pool;
    if u.is_superuser && search_query.is_none() {
        let rows: Vec<crate::infrastructure::persistence::rows::DeckRow> = sqlx::query_as(
            "SELECT id, created_at, updated_at, name, description, field, is_public, background, owner_id FROM backend_deck",
        )
        .fetch_all(pool)
        .await?;
        return deck_rows_to_json(state, rows).await;
    }
    let sq = search_query.unwrap_or("").trim();
    let pattern = format!("%{sq}%");
    let rows: Vec<crate::infrastructure::persistence::rows::DeckRow> = if sq.is_empty() {
        sqlx::query_as(
            r#"SELECT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
               FROM backend_deck d
               WHERE d.is_public = 1 OR d.owner_id = ? OR EXISTS (
                 SELECT 1 FROM backend_userdeckrole r WHERE r.deck_id = d.id AND r.user_id = ?
               )"#,
        )
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(
            r#"SELECT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
               FROM backend_deck d
               INNER JOIN backend_user u ON u.id = d.owner_id
               WHERE (d.is_public = 1 OR d.owner_id = ? OR EXISTS (
                 SELECT 1 FROM backend_userdeckrole r WHERE r.deck_id = d.id AND r.user_id = ?
               ))
               AND (
                 d.name LIKE ? OR u.name LIKE ? OR u.email LIKE ?
               )
               AND (SELECT COUNT(*) FROM backend_term t WHERE t.deck_id = d.id) > 0"#,
        )
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .bind(crate::util::db_uuid::to_mysql_char(u.id))
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .fetch_all(pool)
        .await?
    };
    deck_rows_to_json(state, rows).await
}

async fn deck_rows_to_json(
    state: &AppState,
    rows: Vec<crate::infrastructure::persistence::rows::DeckRow>,
) -> anyhow::Result<Vec<serde_json::Value>> {
    let mut out = Vec::new();
    for d in rows {
        let n = crate::infrastructure::persistence::terms::count_terms_in_deck(&state.db.pool, d.id).await?;
        let owner = users::find_user_by_id(&state.db.pool, d.owner_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("owner"))?;
        out.push(json!({
            "id": d.id.to_string(),
            "name": d.name,
            "description": d.description,
            "is_public": d.is_public,
            "owner": crate::interfaces::http::routes::users::public_user_json(&owner),
            "number_of_term": n,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "background": d.background,
        }));
    }
    Ok(out)
}

#[derive(Deserialize)]
struct CreateDeck {
    name: String,
    description: String,
    field: String,
    is_public: Option<bool>,
    background: Option<String>,
}

async fn create_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Json(body): Json<CreateDeck>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = Uuid::new_v4();
    decks::insert_deck(
        &state.db.pool,
        id,
        &body.name,
        &body.description,
        &body.field,
        body.is_public.unwrap_or(true),
        body.background.as_deref(),
        u.id,
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let d = decks::find_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    let n = crate::infrastructure::persistence::terms::count_terms_in_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let owner = users::find_user_by_id(&state.db.pool, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(json!({
        "id": d.id.to_string(),
        "name": d.name,
        "description": d.description,
        "is_public": d.is_public,
        "owner": crate::interfaces::http::routes::users::public_user_json(&owner),
        "number_of_term": n,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "background": d.background,
    })))
}

#[derive(Deserialize)]
struct SearchQ {
    query: Option<String>,
}

async fn search_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Query(q): Query<SearchQ>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = ElasticsearchClient::new(&state.settings, state.http.clone());
    let body = ElasticsearchClient::deck_search_body(q.query.as_deref().unwrap_or(""), &u.id);
    let res = client.search_raw("decks", body).await;
    match res {
        Ok(v) => Ok(Json(v)),
        Err(e) => {
            tracing::warn!("es search fallback: {e}");
            let rows = deck_list_query(&state, &u, q.query.as_deref()).await.map_err(|x| AppError::Anyhow(x))?;
            Ok(Json(json!(rows)))
        }
    }
}

async fn my_own_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<_> = sqlx::query_as::<_, crate::infrastructure::persistence::rows::DeckRow>(
        "SELECT id, created_at, updated_at, name, description, field, is_public, background, owner_id FROM backend_deck WHERE owner_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j = deck_rows_to_json(&state, rows).await.map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!(j)))
}

async fn others_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<_> = sqlx::query_as::<_, crate::infrastructure::persistence::rows::DeckRow>(
        r#"SELECT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
           FROM backend_deck d
           INNER JOIN backend_userdeckrole r ON r.deck_id = d.id
           WHERE r.user_id = ? AND d.owner_id <> ?"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j = deck_rows_to_json(&state, rows).await.map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!(j)))
}

async fn latest_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<_> = sqlx::query_as::<_, crate::infrastructure::persistence::rows::DeckRow>(
        r#"SELECT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
           FROM backend_deck d
           WHERE d.id IN (
             SELECT deck_id FROM backend_userdeckrole WHERE user_id = ?
             UNION
             SELECT id FROM backend_deck WHERE owner_id = ?
           )
           ORDER BY d.updated_at DESC LIMIT 5"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j = deck_rows_to_json(&state, rows).await.map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!(j)))
}

async fn my_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<_> = sqlx::query_as::<_, crate::infrastructure::persistence::rows::DeckRow>(
        r#"SELECT DISTINCT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
           FROM backend_deck d
           LEFT JOIN backend_userdeckrole r ON r.deck_id = d.id
           WHERE d.owner_id = ? OR r.user_id = ?"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j = deck_rows_to_json(&state, rows).await.map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!(j)))
}

async fn public_decks(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<_> = sqlx::query_as::<_, crate::infrastructure::persistence::rows::DeckRow>(
        r#"SELECT d.id, d.created_at, d.updated_at, d.name, d.description, d.field, d.is_public, d.background, d.owner_id
           FROM backend_deck d
           WHERE d.is_public = 1
           AND d.id NOT IN (
             SELECT deck_id FROM backend_userdeckrole WHERE user_id = ?
             UNION
             SELECT id FROM backend_deck WHERE owner_id = ?
           )
           ORDER BY (SELECT COUNT(*) FROM backend_term t WHERE t.deck_id = d.id) DESC
           LIMIT 5"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_all(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let j = deck_rows_to_json(&state, rows).await.map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!(j)))
}

async fn get_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let d = decks::find_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if !user_can_view(&state, &u, &d).await.map_err(|e| AppError::Anyhow(e))? {
        return Err(AppError::Forbidden);
    }
    decks::update_deck_touch(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    deck_detail(&state, &u, &d).await
}

async fn deck_detail(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    d: &crate::infrastructure::persistence::rows::DeckRow,
) -> Result<Json<serde_json::Value>, AppError> {
    let perm = deck_permission(state, u, d).await.map_err(|e| AppError::Anyhow(e))?;
    let (n, prog) = learning_service::get_learning_progress(state, d.id, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    let roles_json = user_roles_json(state, d.id).await.map_err(|e| AppError::Anyhow(e))?;
    let owner = users::find_user_by_id(&state.db.pool, d.owner_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    Ok(Json(json!({
        "id": d.id.to_string(),
        "name": d.name,
        "description": d.description,
        "is_public": d.is_public,
        "owner": crate::interfaces::http::routes::users::public_user_json(&owner),
        "number_of_term": n,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "background": d.background,
        "user_roles": roles_json,
        "my_permission": perm,
        "learning_progress": {
            "learning": prog.learning,
            "completed": prog.completed,
            "left": prog.left,
            "learned_today": prog.learned_today,
        },
    })))
}

async fn user_roles_json(
    state: &AppState,
    deck_id: impl Into<Uuid>,
) -> anyhow::Result<Vec<serde_json::Value>> {
    let deck_id = deck_id.into();
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"SELECT u.email, r.role FROM backend_userdeckrole r
           INNER JOIN backend_user u ON u.id = r.user_id WHERE r.deck_id = ?"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .fetch_all(&state.db.pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(email, role)| json!({"email": email, "role": role}))
        .collect())
}

async fn deck_permission(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    d: &crate::infrastructure::persistence::rows::DeckRow,
) -> anyhow::Result<Option<char>> {
    if u.is_superuser {
        return Ok(Some(FullRole::Owner.as_char()));
    }
    if d.owner_id == u.id {
        return Ok(Some(FullRole::Owner.as_char()));
    }
    let r: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM backend_userdeckrole WHERE deck_id = ? AND user_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(d.id))
    .bind(crate::util::db_uuid::to_mysql_char(u.id))
    .fetch_optional(&state.db.pool)
    .await?;
    Ok(r.and_then(|(role,)| role.chars().next()))
}

async fn user_can_view(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    d: &crate::infrastructure::persistence::rows::DeckRow,
) -> anyhow::Result<bool> {
    if u.is_superuser || d.is_public {
        return Ok(true);
    }
    Ok(deck_permission(state, u, d).await?.is_some())
}

#[derive(Deserialize)]
struct UpdateDeck {
    name: Option<String>,
    description: Option<String>,
    is_public: Option<bool>,
    field: Option<String>,
    background: Option<String>,
}

async fn update_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDeck>,
) -> Result<Json<serde_json::Value>, AppError> {
    let d = decks::find_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if !user_can_edit(&state, &u, &d).await.map_err(|e| AppError::Anyhow(e))? {
        return Err(AppError::Forbidden);
    }
    decks::update_deck_fields(
        &state.db.pool,
        id,
        body.name.as_deref(),
        body.description.as_deref(),
        body.is_public,
        body.field.as_deref(),
        body.background.as_deref(),
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let d = decks::find_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    deck_detail(&state, &u, &d).await
}

async fn user_can_edit(
    state: &AppState,
    u: &crate::infrastructure::persistence::rows::UserRow,
    d: &crate::infrastructure::persistence::rows::DeckRow,
) -> anyhow::Result<bool> {
    if u.is_superuser {
        return Ok(true);
    }
    let p = deck_permission(state, u, d).await?;
    Ok(matches!(
        p,
        Some(c) if c == FullRole::Edit.as_char() || c == FullRole::Owner.as_char()
    ))
}

async fn delete_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let d = decks::find_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if d.owner_id != u.id && !u.is_superuser {
        return Err(AppError::Forbidden);
    }
    users::clear_default_deck_for_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    decks::delete_deck(&state.db.pool, id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct EmailRole {
    email: String,
    role: String,
}

async fn add_user_to_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(owner): AuthUser,
    Path(deck_id): Path<Uuid>,
    Json(body): Json<EmailRole>,
) -> Result<Json<serde_json::Value>, AppError> {
    let d = decks::find_deck(&state.db.pool, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if d.owner_id != owner.id && !owner.is_superuser {
        return Err(AppError::Forbidden);
    }
    let target = users::find_user_by_email(&state.db.pool, &body.email)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::BadRequest("user not found".into()))?;
    if target.id == owner.id {
        return Err(AppError::BadRequest("user is already in deck".into()));
    }
    let exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM backend_userdeckrole WHERE deck_id = ? AND user_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .bind(crate::util::db_uuid::to_mysql_char(target.id))
    .fetch_one(&state.db.pool)
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    if exists.0 > 0 {
        return Err(AppError::BadRequest("user is already in deck".into()));
    }
    role_repo::insert_role(
        &state.db.pool,
        Uuid::new_v4(),
        target.id,
        deck_id,
        &body.role,
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    let d = decks::find_deck(&state.db.pool, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    deck_detail(&state, &owner, &d).await
}

async fn remove_user_from_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(_u): AuthUser,
    Path(deck_id): Path<Uuid>,
    Json(body): Json<EmailRole>,
) -> Result<axum::http::StatusCode, AppError> {
    let target = users::find_user_by_email(&state.db.pool, &body.email)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::BadRequest("user not found".into()))?;
    role_repo::delete_role(&state.db.pool, target.id, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::OK)
}

#[derive(Deserialize)]
struct InviteBody {
    role: String,
}

async fn get_invite_url_handler(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
    Json(body): Json<InviteBody>,
) -> Result<(axum::http::StatusCode, String), AppError> {
    let d = decks::find_deck(&state.db.pool, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if d.owner_id != u.id && !u.is_superuser {
        return Err(AppError::Forbidden);
    }
    let token = crate::auth::encode_invite_token(&state.settings, deck_id, &body.role)
        .map_err(|e| AppError::Anyhow(e))?;
    let url = format!(
        "{}/invite?token={}",
        state.settings.base_frontend_url.trim_end_matches('/'),
        urlencoding::encode(&token)
    );
    Ok((axum::http::StatusCode::CREATED, url))
}

async fn clear_learning_process(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    learning_service::clear_learning_progress(&state, deck_id, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn join_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    let d = decks::find_deck(&state.db.pool, deck_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or(AppError::NotFound)?;
    if !d.is_public {
        return Err(AppError::BadRequest("You have not permission".into()));
    }
    role_repo::insert_role(
        &state.db.pool,
        Uuid::new_v4(),
        u.id,
        deck_id,
        "V",
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn leave_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    deck_service::leave_deck(&state, deck_id, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn set_default_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    users::update_default_deck(&state.db.pool, u.id, Some(deck_id))
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    crate::application::user_service::clear_user_cache(&state, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!({"message": "update successfully"})))
}

async fn clone_deck(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    Path(deck_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let new_id = deck_service::clone_deck(&state, deck_id, u.id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    let d = decks::find_deck(&state.db.pool, new_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .unwrap();
    deck_detail(&state, &u, &d).await
}
