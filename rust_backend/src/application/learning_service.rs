//! Learning progress aggregation (parity with `backend/services/learning.py`).

use crate::infrastructure::persistence::terms;
use crate::infrastructure::redis_cache::LearningProgressCached;
use crate::state::AppState;
use anyhow::Result;
use chrono::{NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressBreakdown {
    pub learning: i64,
    pub completed: i64,
    pub left: i64,
    pub learned_today: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningStreak {
    pub streak: i64,
    pub studied_today: bool,
}

fn utc_naive_to_local_date(ndt: NaiveDateTime, tz: Tz) -> chrono::NaiveDate {
    Utc.from_utc_datetime(&ndt).with_timezone(&tz).date_naive()
}

pub async fn get_learning_progress(
    state: &AppState,
    deck_id: impl Into<Uuid>,
    user_id: impl Into<Uuid>,
) -> Result<(i64, ProgressBreakdown)> {
    let deck_id = deck_id.into();
    let user_id = user_id.into();
    let tz = state.settings.app_timezone;
    let today_local = Utc::now().with_timezone(&tz).date_naive();

    if let Some(redis) = &state.redis {
        if let Ok(Some(cached)) = redis.get_learning_progress_cached(&deck_id, &user_id).await {
            let p: ProgressBreakdown = serde_json::from_value(cached.progress.clone())?;
            return Ok((cached.deck_term_count, p));
        }
    }

    let rows: Vec<(i32, NaiveDateTime, NaiveDateTime)> = sqlx::query_as(
        r#"SELECT l.score, l.last_revised_at, l.last_learned_at
           FROM backend_term t
           INNER JOIN backend_userlearningprogress l ON t.id = l.term_id
           WHERE l.user_id = ? AND t.deck_id = ?"#,
    )
    .bind(crate::util::db_uuid::to_mysql_char(user_id))
    .bind(crate::util::db_uuid::to_mysql_char(deck_id))
    .fetch_all(&state.db.pool)
    .await?;

    let deck_term = terms::count_terms_in_deck(&state.db.pool, deck_id).await?;
    let total = rows.len() as i64;
    let mut completed = 0i64;
    let mut learned_today = 0i64;
    for (score, lr, ll) in &rows {
        if *score > 5 {
            completed += 1;
        }
        let d1 = utc_naive_to_local_date(*lr, tz);
        let d2 = utc_naive_to_local_date(*ll, tz);
        if d1 == today_local || d2 == today_local {
            learned_today += 1;
        }
    }
    let left = deck_term - total;
    let progress = ProgressBreakdown {
        learning: total - completed,
        completed,
        left,
        learned_today,
    };

    if let Some(redis) = &state.redis {
        let j = json!(progress);
        let pack = LearningProgressCached {
            deck_term_count: deck_term,
            progress: j,
        };
        let _ = redis
            .set_learning_progress_cached(&deck_id, &user_id, &pack)
            .await;
    }

    Ok((deck_term, progress))
}

pub async fn record_study_activity(state: &AppState, user_id: impl Into<Uuid>) -> Result<()> {
    let user_id = user_id.into();
    crate::infrastructure::persistence::users::record_study_activity(
        &state.db.pool,
        user_id,
        state.settings.app_timezone,
    )
    .await
}

pub fn get_learning_streak(state: &AppState, user: &crate::infrastructure::persistence::rows::UserRow) -> LearningStreak {
    let tz = state.settings.app_timezone;
    let today = Utc::now().with_timezone(&tz).date_naive();
    let yesterday = today.pred_opt().unwrap_or(today);
    let last = user.last_study_date;
    let studied_today = last == Some(today);
    let streak = if last == Some(today) || last == Some(yesterday) {
        i64::from(user.learning_streak_count)
    } else {
        0
    };
    LearningStreak {
        streak,
        studied_today,
    }
}

pub async fn clear_learning_progress(
    state: &AppState,
    deck_id: impl Into<Uuid>,
    user_id: impl Into<Uuid>,
) -> Result<()> {
    let deck_id = deck_id.into();
    let user_id = user_id.into();
    crate::infrastructure::persistence::learning::delete_progress_for_user_deck(
        &state.db.pool,
        user_id,
        deck_id,
    )
    .await?;
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&deck_id, &user_id)
            .await;
    }
    Ok(())
}
