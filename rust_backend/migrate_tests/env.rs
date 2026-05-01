//! Load `.env` and migrate-test-specific URLs / credentials.

use anyhow::Context;
use std::path::Path;

/// Load `rust_backend/.env` if present (same directory as workspace package root).
pub fn load_dotenv() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    if path.exists() {
        let _ = dotenvy::from_path(path);
    }
}

pub fn legacy_api_base() -> Option<String> {
    std::env::var("LEGACY_API_BASE_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.trim_end_matches('/').to_string())
}

pub fn rust_api_base() -> Option<String> {
    std::env::var("RUST_API_BASE_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.trim_end_matches('/').to_string())
}

pub fn migrate_test_inspect() -> bool {
    matches!(
        std::env::var("MIGRATE_TEST_INSPECT").ok().as_deref(),
        Some("1") | Some("true") | Some("True")
    )
}

pub async fn access_token_or_login(
    client: &reqwest::Client,
    legacy_base: &str,
) -> anyhow::Result<String> {
    if let Ok(t) = std::env::var("MIGRATE_TEST_ACCESS_TOKEN") {
        if !t.is_empty() {
            return Ok(t);
        }
    }
    let email = std::env::var("MIGRATE_TEST_USER_EMAIL")
        .context("set MIGRATE_TEST_ACCESS_TOKEN or MIGRATE_TEST_USER_EMAIL + MIGRATE_TEST_USER_PASSWORD")?;
    let password = std::env::var("MIGRATE_TEST_USER_PASSWORD").context("missing MIGRATE_TEST_USER_PASSWORD")?;
    let body = serde_json::json!({
        "email": email,
        "password": password,
    });
    let url = format!("{legacy_base}/api/users/login/");
    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .with_context(|| format!("POST {url}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let txt = res.text().await.unwrap_or_default();
        anyhow::bail!("login failed: {status} {txt}");
    }
    let v: serde_json::Value = res.json().await?;
    v.get("access")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .context("login response missing access token")
}

/// Returns `None` if parity tests should be skipped (CI without dual servers).
pub fn migrate_context_ready() -> bool {
    legacy_api_base().is_some() && rust_api_base().is_some()
}
