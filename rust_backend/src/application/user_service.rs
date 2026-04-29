//! User application service (activation, cache invalidation).

use crate::infrastructure::persistence::users;
use crate::state::AppState;
use anyhow::Result;
use uuid::Uuid;

pub async fn active_user(state: &AppState, user_id: impl Into<Uuid>) -> Result<()> {
    let user_id = user_id.into();
    users::set_user_validated(&state.db.pool, user_id).await?;
    if let Some(r) = &state.redis {
        let _ = r.delete_user_cache(&user_id).await;
    }
    Ok(())
}

pub async fn clear_user_cache(state: &AppState, user_id: impl Into<Uuid>) -> Result<()> {
    let user_id = user_id.into();
    if let Some(r) = &state.redis {
        let _ = r.delete_user_cache(&user_id).await;
    }
    Ok(())
}
