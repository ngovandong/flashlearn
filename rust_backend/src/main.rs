use anyhow::Context;
use flashlearn_server::config::Settings;
use flashlearn_server::infrastructure::database::Database;
use flashlearn_server::interfaces::http::serve;
use flashlearn_server::state::AppState;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    let settings = Arc::new(Settings::from_env().context("load settings")?);
    let db = Database::connect(settings.as_ref()).await?;
    let state = AppState::new(settings.clone(), db).await?;

    let addr = format!("{}:{}", settings.host, settings.port);
    tracing::info!("listening on http://{}", addr);
    serve(state, &addr).await?;

    Ok(())
}
