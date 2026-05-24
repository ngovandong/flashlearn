//! HTTP application: routes, CORS, tracing.

use crate::interfaces::http::routes::{decks, folders, images, learnings, misc, roles, terms, users};
use crate::interfaces::ws;
use crate::state::AppState;
use axum::extract::DefaultBodyLimit;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub async fn serve(state: AppState, addr: &str) -> anyhow::Result<()> {
    let shared = Arc::new(state);
    let app = create_router(shared);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = build_cors(&state);

    Router::new()
        .route("/healthz", get(health))
        .merge(users::public_routes())
        .merge(users::protected_routes())
        .merge(decks::routes())
        .merge(terms::routes())
        .merge(folders::routes())
        .merge(roles::routes())
        .merge(learnings::routes())
        .merge(misc::routes())
        .merge(images::routes())
        .merge(ws::routes())
        .layer(TraceLayer::new_for_http())
        .layer(DefaultBodyLimit::max(32 * 1024 * 1024))
        .layer(cors)
        .with_state(state)
}

fn build_cors(state: &Arc<AppState>) -> CorsLayer {
    if state.settings.cors_allow_all {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let origins: Vec<_> = state
            .settings
            .cors_allowed_origins
            .iter()
            .filter_map(|s| s.parse().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(tower_http::cors::AllowOrigin::list(origins))
            .allow_methods([
                axum::http::Method::GET,
                axum::http::Method::POST,
                axum::http::Method::PUT,
                axum::http::Method::PATCH,
                axum::http::Method::DELETE,
                axum::http::Method::OPTIONS,
            ])
            .allow_headers(Any)
    }
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}
