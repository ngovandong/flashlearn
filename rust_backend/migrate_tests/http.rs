//! HTTP calls against legacy (Django) and Rust APIs.

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, Method, StatusCode};
use serde_json::Value;

pub fn bearer_headers(token: &str) -> HeaderMap {
    let mut h = HeaderMap::new();
    let v = format!("Bearer {token}");
    if let Ok(val) = HeaderValue::from_str(&v) {
        h.insert(AUTHORIZATION, val);
    }
    h
}

pub struct DualResponse {
    pub legacy_status: StatusCode,
    pub legacy_body: Value,
    pub rust_status: StatusCode,
    pub rust_body: Value,
}

pub async fn request_json(
    client: &Client,
    base: &str,
    method: Method,
    path: &str,
    headers: HeaderMap,
    body: Option<Value>,
) -> anyhow::Result<(StatusCode, Value)> {
    let url = format!("{}{}", base.trim_end_matches('/'), path);
    let mut req = client.request(method, &url).headers(headers);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if text.trim().is_empty() {
        return Ok((status, Value::Null));
    }
    let v: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
    Ok((status, v))
}

pub async fn get_json_both(
    client: &Client,
    legacy_base: &str,
    rust_base: &str,
    path: &str,
    token: &str,
) -> anyhow::Result<DualResponse> {
    let h = bearer_headers(token);
    let (ls, lb) = request_json(
        client,
        legacy_base,
        Method::GET,
        path,
        h.clone(),
        None,
    )
    .await?;
    let (rs, rb) = request_json(client, rust_base, Method::GET, path, h, None).await?;
    Ok(DualResponse {
        legacy_status: ls,
        legacy_body: lb,
        rust_status: rs,
        rust_body: rb,
    })
}

pub async fn post_json_both(
    client: &Client,
    legacy_base: &str,
    rust_base: &str,
    path: &str,
    token: &str,
    body: Value,
) -> anyhow::Result<DualResponse> {
    post_json_pair(client, legacy_base, rust_base, path, token, body.clone(), body).await
}

/// Same path, different JSON bodies (e.g. different foreign keys per backend).
pub async fn post_json_pair(
    client: &Client,
    legacy_base: &str,
    rust_base: &str,
    path: &str,
    token: &str,
    legacy_body: Value,
    rust_body: Value,
) -> anyhow::Result<DualResponse> {
    let h = bearer_headers(token);
    let (ls, lb) = request_json(
        client,
        legacy_base,
        Method::POST,
        path,
        h.clone(),
        Some(legacy_body),
    )
    .await?;
    let (rs, rb) = request_json(
        client,
        rust_base,
        Method::POST,
        path,
        h,
        Some(rust_body),
    )
    .await?;
    Ok(DualResponse {
        legacy_status: ls,
        legacy_body: lb,
        rust_status: rs,
        rust_body: rb,
    })
}

pub async fn put_json_both(
    client: &Client,
    legacy_base: &str,
    rust_base: &str,
    path: &str,
    token: &str,
    body: Value,
) -> anyhow::Result<DualResponse> {
    let h = bearer_headers(token);
    let (ls, lb) = request_json(
        client,
        legacy_base,
        Method::PUT,
        path,
        h.clone(),
        Some(body.clone()),
    )
    .await?;
    let (rs, rb) = request_json(
        client,
        rust_base,
        Method::PUT,
        path,
        h,
        Some(body),
    )
    .await?;
    Ok(DualResponse {
        legacy_status: ls,
        legacy_body: lb,
        rust_status: rs,
        rust_body: rb,
    })
}

pub async fn delete_both(
    client: &Client,
    legacy_base: &str,
    rust_base: &str,
    path: &str,
    token: &str,
) -> anyhow::Result<(StatusCode, StatusCode)> {
    let h = bearer_headers(token);
    let (ls, _) = request_json(
        client,
        legacy_base,
        Method::DELETE,
        path,
        h.clone(),
        None,
    )
    .await?;
    let (rs, _) = request_json(client, rust_base, Method::DELETE, path, h, None).await?;
    Ok((ls, rs))
}
