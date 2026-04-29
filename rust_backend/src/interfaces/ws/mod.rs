mod quick_revise;

use crate::state::AppState;
use axum::routing::get;
use axum::Router;
use std::sync::Arc;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new().route(
        "/ws/quick-revise/",
        get(quick_revise::quick_revise_ws),
    )
}
