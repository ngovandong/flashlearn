use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, body) = match &self {
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, json!({ "detail": msg })),
            AppError::Forbidden => (StatusCode::FORBIDDEN, json!({ "detail": "forbidden" })),
            AppError::NotFound => (StatusCode::NOT_FOUND, json!({ "detail": "not found" })),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, json!({ "detail": msg })),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, json!({ "detail": msg })),
            AppError::Anyhow(e) => {
                tracing::error!("internal error: {:#}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    json!({ "detail": "internal server error" }),
                )
            }
        };
        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
