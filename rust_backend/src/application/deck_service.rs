//! Deck-related use cases (query sets, clone, leave).

use crate::infrastructure::persistence::rows::TermRow;
use crate::infrastructure::persistence::{decks, learning, roles, terms, users};
use crate::state::AppState;
use anyhow::Result;
use uuid::Uuid;

pub async fn leave_deck(
    state: &AppState,
    deck_id: impl Into<Uuid>,
    user_id: impl Into<Uuid>,
) -> Result<()> {
    let deck_id = deck_id.into();
    let user_id = user_id.into();
    learning::delete_progress_for_user_deck(&state.db.pool, user_id, deck_id).await?;
    roles::delete_role(&state.db.pool, user_id, deck_id).await?;
    Ok(())
}

pub async fn clone_deck(
    state: &AppState,
    old_deck_id: impl Into<Uuid>,
    new_owner: impl Into<Uuid>,
) -> Result<Uuid> {
    let old_deck_id = old_deck_id.into();
    let new_owner = new_owner.into();
    let old = decks::find_deck(&state.db.pool, old_deck_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("deck not found"))?;
    let new_id = Uuid::new_v4();
    let owner = users::find_user_by_id(&state.db.pool, old.owner_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("owner missing"))?;
    let name = format!("Copy of {} - {}", owner.name, old.name);
    decks::insert_deck(
        &state.db.pool,
        new_id,
        &name,
        &old.description,
        &old.field,
        false,
        old.background.as_deref(),
        new_owner,
    )
    .await?;
    let term_rows: Vec<TermRow> = sqlx::query_as(
        "SELECT id, created_at, updated_at, name, meaning, image, deck_id FROM backend_term WHERE deck_id = ?",
    )
    .bind(crate::util::db_uuid::to_mysql_char(old_deck_id))
    .fetch_all(&state.db.pool)
    .await?;
    for t in term_rows {
        terms::insert_term(
            &state.db.pool,
            Uuid::new_v4(),
            &t.name,
            &t.meaning,
            t.image.as_deref(),
            new_id,
        )
        .await?;
    }
    Ok(new_id)
}
