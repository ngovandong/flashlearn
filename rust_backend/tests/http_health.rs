//! Optional smoke GET against a running Rust server (`RUST_API_BASE_URL`).

use std::path::Path;

fn load_dotenv() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    if path.exists() {
        let _ = dotenvy::from_path(path);
    }
}

#[tokio::test]
async fn rust_server_healthz() {
    load_dotenv();
    let Some(base) = std::env::var("RUST_API_BASE_URL")
        .ok()
        .filter(|s| !s.is_empty())
    else {
        eprintln!("skip http_health: set RUST_API_BASE_URL and run the Rust server");
        return;
    };
    let url = format!("{}/healthz", base.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .build()
        .expect("client");
    let res = client.get(&url).send().await.expect("GET healthz");
    assert!(
        res.status().is_success(),
        "healthz: {} {}",
        res.status(),
        res.text().await.unwrap_or_default()
    );
}
