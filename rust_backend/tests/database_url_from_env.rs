//! Unit-style test for [`flashlearn_server::config::Settings::database_url_from_env`].

use std::sync::Mutex;

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn clear_db_env() {
    for k in ["DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME", "DATABASE_URL"] {
        std::env::remove_var(k);
    }
}

#[test]
fn database_url_from_env_uses_database_url_when_set() {
    let _lock = ENV_LOCK.lock().expect("env test lock");
    clear_db_env();
    std::env::set_var("DATABASE_URL", "mysql://a:b@localhost:3306/db");
    let url = flashlearn_server::config::Settings::database_url_from_env().expect("url");
    assert_eq!(url, "mysql://a:b@localhost:3306/db");
    clear_db_env();
}

#[test]
fn database_url_from_env_builds_from_db_vars() {
    let _lock = ENV_LOCK.lock().expect("env test lock");
    clear_db_env();
    std::env::set_var("DB_USER", "u");
    std::env::set_var("DB_PASSWORD", "p");
    std::env::set_var("DB_HOST", "h");
    std::env::set_var("DB_PORT", "3307");
    std::env::set_var("DB_NAME", "n");
    let url = flashlearn_server::config::Settings::database_url_from_env().expect("url");
    assert_eq!(url, "mysql://u:p@h:3307/n");
    clear_db_env();
}
