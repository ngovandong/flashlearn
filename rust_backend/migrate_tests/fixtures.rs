//! Unique labels for isolated migrate-test rows.

use uuid::Uuid;

pub fn unique_tag() -> String {
    Uuid::new_v4().to_string()
}

pub fn folder_name(tag: &str) -> String {
    format!("migrate_test_folder_{tag}")
}

pub fn deck_name(tag: &str) -> String {
    format!("migrate_test_deck_{tag}")
}

pub fn term_name(tag: &str) -> String {
    format!("migrate_test_term_{tag}")
}
