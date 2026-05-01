//! `/api/translate/`

use crate::error::AppError;
use crate::state::AppState;
use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use std::sync::Arc;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/translate/", post(translate))
        .route("/api/translate", post(translate))
}

#[derive(Deserialize)]
struct TranslateBody {
    text: String,
    #[serde(default)]
    source_language: Option<String>,
    #[serde(default)]
    target_language: Option<String>,
}

async fn translate(
    State(state): State<Arc<AppState>>,
    Json(body): Json<TranslateBody>,
) -> Result<String, AppError> {
    let tl = body.target_language.as_deref().unwrap_or("vi");
    let sl = body.source_language.as_deref().unwrap_or("auto");
    let url = "https://translate.google.com/translate_a/single";
    let res = state
        .http
        .get(url)
        .query(&[
            ("client", "gtx"),
            ("sl", sl),
            ("tl", tl),
            ("hl", tl),
            ("dt", "t"),
            ("q", &body.text),
        ])
        .send()
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let data: serde_json::Value = res.json().await.map_err(|e| AppError::Anyhow(e.into()))?;
    let mut meaning = String::new();
    if let Some(arr) = data.get(0).and_then(|x| x.as_array()) {
        for line in arr {
            if let Some(t) = line.get(0).and_then(|x| x.as_str()) {
                meaning.push_str(t);
            }
        }
    }
    Ok(meaning)
}
