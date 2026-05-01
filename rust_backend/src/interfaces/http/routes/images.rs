//! `/api/images/` — Bing image preview URLs.

use crate::error::AppError;
use crate::state::AppState;
use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use regex::Regex;
use scraper::{Html, Selector};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/images/", post(image_urls))
        .route("/api/images", post(image_urls))
}

#[derive(Deserialize)]
struct ImgBody {
    query: Option<String>,
    #[serde(default)]
    count: Option<usize>,
}

async fn image_urls(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ImgBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let query = body.query.ok_or_else(|| AppError::BadRequest("Missing query parameter".into()))?;
    let count = body.count.unwrap_or(10).min(50);
    let params = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("q", &query)
        .finish();
    let url = format!("https://www.bing.com/images/search?{params}");
    let res = state
        .http
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.0.0 Safari/537.36",
        )
        .header("Accept-Language", "en-US,en;q=0.5")
        .send()
        .await
        .map_err(|e| AppError::Anyhow(e.into()))?;
    let text = res.text().await.map_err(|e| AppError::Anyhow(e.into()))?;
    let doc = Html::parse_document(&text);
    let sel = Selector::parse("div.imgpt a.iusc img").map_err(|e| AppError::BadRequest(e.to_string()))?;
    let re = Regex::new(r"https://tse\d.mm.bing.net/").unwrap();
    let mut urls = Vec::new();
    for el in doc.select(&sel) {
        if let Some(src) = el.value().attr("src") {
            if re.is_match(src) {
                urls.push(src.to_string());
            }
        }
        if urls.len() >= count {
            break;
        }
    }
    Ok(Json(json!({ "query": query, "urls": urls })))
}
