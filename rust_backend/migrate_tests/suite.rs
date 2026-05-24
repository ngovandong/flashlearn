//! Integration tests: Django vs Rust API parity (`cargo test --test migrate_tests`).
//!
//! Requires `LEGACY_API_BASE_URL`, `RUST_API_BASE_URL`, and either `MIGRATE_TEST_ACCESS_TOKEN`
//! or `MIGRATE_TEST_USER_EMAIL` / `MIGRATE_TEST_USER_PASSWORD` (login via legacy).
//! Loads `rust_backend/.env` for `DATABASE_URL` / `DB_*` when inspecting or cleaning up.

mod cases;
mod compare;
mod db;
mod env;
mod fixtures;
mod http;

use crate::db::{connect_pool, print_inspect_snapshot};
use crate::env::{load_dotenv, migrate_context_ready, migrate_test_inspect};

#[tokio::test]
async fn migrate_inspect_db_optional() {
    load_dotenv();
    if !migrate_test_inspect() {
        return;
    }
    let Ok(pool) = connect_pool().await else {
        eprintln!("MIGRATE_TEST_INSPECT: could not connect MySQL (set DATABASE_URL or DB_*)");
        return;
    };
    print_inspect_snapshot(&pool).await;
}

#[tokio::test]
async fn migrate_phase1_folder_deck_term_crud() {
    load_dotenv();
    if !migrate_context_ready() {
        eprintln!("skip migrate_phase1: set LEGACY_API_BASE_URL and RUST_API_BASE_URL");
        return;
    }
    cases::run_phase1_crud()
        .await
        .expect("phase1 parity");
}
