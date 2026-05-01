//! WebSocket `QuickReviseConsumer` parity (`ws/quick-revise/?token=&deck_id=`).

use crate::application::term_service::{self, ProgressTerm};
use crate::auth::jwt::verify_access_token;
use crate::infrastructure::persistence::{decks, users};
use crate::state::AppState;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::Query;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use rand::seq::SliceRandom;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct WsParams {
    pub token: String,
    pub deck_id: String,
}

pub async fn quick_revise_ws(
    ws: WebSocketUpgrade,
    Query(q): Query<WsParams>,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, q))
}

struct GameState {
    score: i32,
    current_index: i32,
    revise_terms: Vec<ProgressTerm>,
    all_terms: Vec<term_service::OnlyName>,
    current_term: Option<ProgressTerm>,
    leftover_time: f64,
    question_start: Option<std::time::Instant>,
    deck_id: Uuid,
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>, q: WsParams) {
    let deck_id = match Uuid::parse_str(&q.deck_id) {
        Ok(v) => v,
        Err(_) => {
            let _ = socket.close().await;
            return;
        }
    };
    let claims = match verify_access_token(&state.settings, &q.token) {
        Ok(c) => c,
        Err(_) => {
            let _ = socket.close().await;
            return;
        }
    };
    let uid_str = match claims.user_id.as_str() {
        Some(s) => s,
        None => {
            let _ = socket.close().await;
            return;
        }
    };
    let user_id = match Uuid::parse_str(uid_str) {
        Ok(u) => u,
        Err(_) => {
            let _ = socket.close().await;
            return;
        }
    };
    let user = match users::find_user_by_id(&state.db.pool, user_id).await {
        Ok(Some(u)) => u,
        _ => {
            let _ = socket.close().await;
            return;
        }
    };
    let deck = match decks::find_deck(&state.db.pool, deck_id).await {
        Ok(Some(d)) => d,
        _ => {
            let _ = socket.close().await;
            return;
        }
    };
    if !deck.is_public {
        let ok: (i64,) = match sqlx::query_as(
            "SELECT COUNT(*) FROM backend_userdeckrole WHERE deck_id = ? AND user_id = ?",
        )
        .bind(crate::util::db_uuid::to_mysql_char(deck_id))
        .bind(crate::util::db_uuid::to_mysql_char(user_id))
        .fetch_one(&state.db.pool)
        .await
        {
            Ok(x) => x,
            Err(_) => {
                let _ = socket.close().await;
                return;
            }
        };
        if ok.0 == 0 && uuid::Uuid::from(deck.owner_id) != user_id {
            let _ = socket.close().await;
            return;
        }
    }

    let mut game = GameState {
        score: 0,
        current_index: 0,
        revise_terms: vec![],
        all_terms: vec![],
        current_term: None,
        leftover_time: 0.0,
        question_start: None,
        deck_id,
    };

    while let Some(msg) = socket.next().await {
        let Ok(msg) = msg else { break };
        if let Message::Text(text) = msg {
            let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
            let action = data.get("action").and_then(|x| x.as_str());
            match action {
                Some("start") => {
                    if let Ok(p) = term_service::get_revise_terms_data(&state, user_id, deck_id).await {
                        game.revise_terms = p.revise_terms;
                        game.all_terms = p.all_terms;
                    }
                    if send_next(&mut socket, &mut game).await.is_err() {
                        break;
                    }
                }
                Some("answer") => {
                    let ans = data.get("answer").and_then(|x| x.as_str()).unwrap_or("");
                    if handle_answer(&mut socket, &state, &mut game, &user, ans).await.is_err() {
                        break;
                    }
                }
                _ => {}
            }
        }
    }
    if let Some(r) = &state.redis {
        let _ = r
            .delete_learning_progress_cached(&deck_id, &user_id)
            .await;
    }
}

async fn send_next(socket: &mut WebSocket, game: &mut GameState) -> Result<(), ()> {
    if game.revise_terms.is_empty() {
        return Err(());
    }
    let current = game.revise_terms.remove(0);
    let distractors: Vec<_> = game
        .all_terms
        .iter()
        .filter(|t| t.id != current.id)
        .cloned()
        .collect();
    let mut opts: Vec<String> = {
        let mut rng = rand::thread_rng();
        let mut opts: Vec<String> = vec![current.name.clone()];
        let mut shuf: Vec<_> = distractors.into_iter().take(3).collect();
        shuf.shuffle(&mut rng);
        for t in shuf {
            opts.push(t.name);
        }
        opts.shuffle(&mut rng);
        opts
    };
    let idx = game.current_index.max(0);
    let base_time = (10 - idx * 2).max(2);
    let time_limit = base_time as f64 + game.leftover_time;
    game.current_term = Some(current.clone());
    game.question_start = Some(std::time::Instant::now());
    let payload = json!({
        "progressId": current.learning_progress_id.to_string(),
        "question": current.description,
        "answer": current.name,
        "image": current.image,
        "options": opts,
        "type": "quiz",
    });
    let msg = json!({
        "type": "new_question",
        "question": payload,
        "time_limit": time_limit,
        "index": idx + 1,
    });
    socket
        .send(Message::Text(msg.to_string()))
        .await
        .map_err(|_| ())?;
    Ok(())
}

async fn handle_answer(
    socket: &mut WebSocket,
    state: &AppState,
    game: &mut GameState,
    user: &crate::infrastructure::persistence::rows::UserRow,
    user_answer: &str,
) -> Result<(), ()> {
    let now = std::time::Instant::now();
    let start = game.question_start.unwrap_or(now);
    let elapsed = now.duration_since(start).as_secs_f64();
    let idx = game.current_index.max(0);
    let base_time = (10 - idx * 2).max(2) as f64;
    let start_left = game.leftover_time / 2.0;
    let current_limit = base_time + if game.leftover_time > 0.0 { start_left } else { 0.0 };
    game.leftover_time = (current_limit - elapsed).max(0.0);

    let current = match &game.current_term {
        Some(c) => c.clone(),
        None => return Err(()),
    };
    let correct = current.name.clone();
    if user_answer.trim().eq_ignore_ascii_case(&correct) {
        let _ = sqlx::query(
            r#"UPDATE backend_userlearningprogress SET score = score + 1, last_revised_at = CURRENT_TIMESTAMP(6)
               WHERE user_id = ? AND term_id = ?"#,
        )
        .bind(crate::util::db_uuid::to_mysql_char(user.id))
        .bind(crate::util::db_uuid::to_mysql_char(current.id))
        .execute(&state.db.pool)
        .await;
        game.score += 1;
        let _ = socket
            .send(Message::Text(json!({"type": "result", "correct": true}).to_string()))
            .await;
        game.current_index += 1;
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if send_next(socket, game).await.is_err() {
            return Err(());
        }
    } else {
        let _ = socket
            .send(
                Message::Text(
                    json!({
                        "type": "game_over",
                        "reason": "wrong_answer",
                        "correct_answer": correct,
                        "final_score": game.score,
                    })
                    .to_string(),
                ),
            )
            .await;
    }
    Ok(())
}
