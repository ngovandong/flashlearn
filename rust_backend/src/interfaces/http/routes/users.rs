//! `/api/users/*` routes.

use crate::auth::jwt::{issue_token_pair, verify_refresh_token};
use crate::error::AppError;
use crate::infrastructure::django_password;
use crate::infrastructure::persistence::users;
use crate::interfaces::http::extractors::AuthUser;
use crate::state::AppState;
use axum::extract::{Query, State};
use axum::body::Body;
use axum::http::header::LOCATION;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub fn public_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/users/login/", post(login))
        .route("/api/users/login", post(login))
        .route("/api/users/refresh/", post(refresh))
        .route("/api/users/refresh", post(refresh))
        .route("/api/users/sign_up/", post(sign_up))
        .route("/api/users/sign_up", post(sign_up))
        .route("/api/users/google_login/", get(google_login))
        .route("/api/users/google_login", get(google_login))
        .route("/api/users/init/", get(init))
        .route("/api/users/init", get(init))
        .route("/api/users/active_account/", get(active_account))
        .route("/api/users/active_account", get(active_account))
}

pub fn protected_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/users/get_profile/", get(get_profile))
        .route("/api/users/get_profile", get(get_profile))
        .route("/api/users/", get(list_users))
        .route("/api/users", get(list_users))
        .route("/api/users/:id/change_password/", post(change_password))
        .route("/api/users/:id/change_password", post(change_password))
}

#[derive(Deserialize)]
struct LoginBody {
    username: Option<String>,
    email: Option<String>,
    password: String,
}

async fn login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<LoginBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ident = body
        .email
        .or(body.username)
        .ok_or_else(|| AppError::BadRequest("email or username required".into()))?;
    let u = users::find_user_by_email(&state.db.pool, &ident)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("invalid credentials".into()))?;
    if !django_password::verify(&body.password, &u.password) {
        return Err(AppError::Unauthorized("invalid credentials".into()));
    }
    if !u.is_validated_email {
        return Err(AppError::BadRequest(
            "Please activate your email account!".into(),
        ));
    }
    let user_json = user_json_for_token(&u);
    let pair = issue_token_pair(&state.settings, u.id, user_json).map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!({
        "refresh": pair.refresh,
        "access": pair.access,
    })))
}

#[derive(Deserialize)]
struct RefreshBody {
    refresh: String,
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RefreshBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let claims = verify_refresh_token(&state.settings, &body.refresh)
        .map_err(|_| AppError::Unauthorized("invalid refresh".into()))?;
    let uid_str = claims
        .user_id
        .as_str()
        .ok_or_else(|| AppError::Unauthorized("bad token".into()))?;
    let user_id = Uuid::parse_str(uid_str).map_err(|_| AppError::Unauthorized("bad token".into()))?;
    let u = users::find_user_by_id(&state.db.pool, user_id)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("user not found".into()))?;
    let user_json = user_json_for_token(&u);
    let pair = issue_token_pair(&state.settings, u.id, user_json).map_err(|e| AppError::Anyhow(e))?;
    Ok(Json(json!({
        "refresh": pair.refresh,
        "access": pair.access,
    })))
}

#[derive(Deserialize)]
struct SignUpBody {
    email: String,
    password: String,
    name: String,
    first_name: Option<String>,
    last_name: Option<String>,
}

async fn sign_up(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SignUpBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if users::find_user_by_email(&state.db.pool, &body.email)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?
        .is_some()
    {
        return Err(AppError::BadRequest("email exists".into()));
    }
    let id = Uuid::new_v4();
    let hash = django_password::encode(&body.password, state.settings.pbkdf2_iterations);
    users::insert_user(
        &state.db.pool,
        id,
        &hash,
        &body.name,
        &body.email,
        body.first_name.as_deref().unwrap_or(""),
        body.last_name.as_deref().unwrap_or(""),
        None,
    )
    .await
    .map_err(|e| AppError::Anyhow(e.into()))?;

    tracing::info!(
        "sign_up: user {} created; activation email not sent (configure EMAIL_* env or use Django worker)",
        body.email
    );

    Ok(Json(json!({
        "id": id.to_string(),
        "email": body.email,
        "name": body.name,
    })))
}

async fn get_profile(AuthUser(u): AuthUser) -> Json<serde_json::Value> {
    Json(user_json_for_token(&u))
}

async fn list_users(AuthUser(_): AuthUser) -> Json<serde_json::Value> {
    Json(json!([]))
}

#[derive(Deserialize)]
struct ChangePasswordBody {
    old_password: String,
    new_password: String,
}

async fn change_password(
    State(state): State<Arc<AppState>>,
    AuthUser(u): AuthUser,
    axum::extract::Path(user_id): axum::extract::Path<Uuid>,
    Json(body): Json<ChangePasswordBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if uuid::Uuid::from(u.id) != user_id {
        return Err(AppError::Forbidden);
    }
    if !django_password::verify(&body.old_password, &u.password) {
        return Err(AppError::BadRequest("Wrong password.".into()));
    }
    if body.old_password == body.new_password {
        return Err(AppError::BadRequest(
            "new password must be difference!".into(),
        ));
    }
    let hash = django_password::encode(&body.new_password, state.settings.pbkdf2_iterations);
    users::update_user_password(&state.db.pool, user_id, &hash)
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    if let Some(r) = &state.redis {
        let _ = r.delete_user_cache(&user_id).await;
    }
    Ok(Json(json!({"status": "password changed"})))
}

#[derive(Deserialize)]
struct GoogleCb {
    code: Option<String>,
    error: Option<String>,
}

async fn google_login(
    State(state): State<Arc<AppState>>,
    Query(q): Query<GoogleCb>,
) -> Result<Response, AppError> {
    let login_url = format!("{}/login", state.settings.base_frontend_url.trim_end_matches('/'));
    if let Some(err) = q.error {
        let u = urlencoding::encode(&err);
        let loc = format!("{login_url}?error={u}");
        return Ok(
            Response::builder()
                .status(StatusCode::TEMPORARY_REDIRECT)
                .header(LOCATION, loc)
                .body(Body::empty())
                .unwrap()
                .into_response(),
        );
    }
    let code = q.code.ok_or_else(|| AppError::BadRequest("no code".into()))?;
    let redirect_uri = format!(
        "{}/api/users/google_login/",
        state.settings.base_backend_url.trim_end_matches('/')
    );
    let token = google_exchange_code(&state, &code, &redirect_uri).await?;
    let profile = google_user_info(&state, &token).await?;
    // Simplified: get-or-create path should mirror Python UserService — placeholder returns redirect with error
    let _ = (profile, token);
    Err(AppError::BadRequest("google_login: complete user_get_or_create in deployment".into()))
}

async fn init(
    State(_state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    let _token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("token is require".into()))?;
    Err(AppError::BadRequest(
        "init: id_token validation not wired in this build".into(),
    ))
}

#[derive(Deserialize)]
struct ActiveQ {
    token: String,
}

async fn active_account(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ActiveQ>,
) -> Result<Response, AppError> {
    let claims = verify_refresh_token(&state.settings, &q.token)
        .map_err(|_| AppError::BadRequest("invalid token".into()))?;
    let uid_str = claims.user_id.as_str().ok_or_else(|| AppError::BadRequest("bad token".into()))?;
    let user_id = Uuid::parse_str(uid_str).map_err(|_| AppError::BadRequest("bad token".into()))?;
    crate::application::user_service::active_user(&state, user_id)
        .await
        .map_err(|e| AppError::Anyhow(e))?;
    let pair = issue_token_pair(
        &state.settings,
        user_id,
        json!({}),
    )
    .map_err(|e| AppError::Anyhow(e))?;
    let login_url = state.settings.base_frontend_url.clone();
    let loc = format!(
        "{}/login?refresh={}&access={}",
        login_url.trim_end_matches('/'),
        urlencoding::encode(&pair.refresh),
        urlencoding::encode(&pair.access)
    );
    Ok(Response::builder()
        .status(StatusCode::TEMPORARY_REDIRECT)
        .header(LOCATION, loc)
        .body(Body::empty())
        .unwrap())
}

pub fn public_user_json(u: &crate::infrastructure::persistence::rows::UserRow) -> serde_json::Value {
    json!({
        "id": u.id.to_string(),
        "email": u.email,
        "name": u.name,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "image_url": u.image_url,
        "default_deck": u.default_deck_id.map(|d| d.to_string()),
    })
}

fn user_json_for_token(u: &crate::infrastructure::persistence::rows::UserRow) -> serde_json::Value {
    public_user_json(u)
}

async fn google_exchange_code(
    state: &Arc<AppState>,
    code: &str,
    redirect_uri: &str,
) -> Result<String, AppError> {
    let body = [
        ("code", code),
        ("client_id", state.settings.google_oauth_client_id.as_str()),
        ("client_secret", state.settings.google_oauth_client_secret.as_str()),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];
    let res = state
        .http
        .post("https://oauth2.googleapis.com/token")
        .form(&body)
        .send()
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    if !res.status().is_success() {
        return Err(AppError::BadRequest("google token exchange failed".into()));
    }
    let v: serde_json::Value = res.json().await.map_err(|e| AppError::Anyhow(e.into()))?;
    v.get("access_token")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::BadRequest("no access_token".into()))
}

async fn google_user_info(state: &Arc<AppState>, access: &str) -> Result<serde_json::Value, AppError> {
    let res = state
        .http
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(access)
        .send()
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    res.json()
        .await
        .map_err(|e| AppError::Anyhow(e.into()))
}
