//! Optional MySQL inspection and SQL cleanup for migrate tests.

use anyhow::Context;
use sqlx::MySqlPool;

pub async fn connect_pool() -> anyhow::Result<MySqlPool> {
    let url = flashlearn_server::config::Settings::database_url_from_env()?;
    MySqlPool::connect(&url)
        .await
        .with_context(|| "connect MySQL (DATABASE_URL or DB_*)")
}

/// Row counts for core tables (debugging).
pub async fn table_counts(pool: &MySqlPool) -> anyhow::Result<Vec<(String, i64)>> {
    let tables = [
        "backend_user",
        "backend_folder",
        "backend_deck",
        "backend_term",
        "backend_userdeckrole",
    ];
    let mut out = Vec::new();
    for t in tables {
        let q = format!("SELECT COUNT(*) as c FROM {t}");
        let row: (i64,) = sqlx::query_as(&q).fetch_one(pool).await?;
        out.push((t.to_string(), row.0));
    }
    Ok(out)
}

pub async fn print_inspect_snapshot(pool: &MySqlPool) {
    match table_counts(pool).await {
        Ok(rows) => {
            eprintln!("--- MIGRATE_TEST_INSPECT DB snapshot ---");
            for (t, c) in rows {
                eprintln!("  {t}: {c}");
            }
            eprintln!("--- end snapshot ---");
        }
        Err(e) => eprintln!("inspect snapshot failed: {e}"),
    }
}

#[derive(Default, Debug)]
pub struct SqlCleanup {
    pub term_ids: Vec<uuid::Uuid>,
    pub deck_ids: Vec<uuid::Uuid>,
    pub folder_ids: Vec<uuid::Uuid>,
}

impl SqlCleanup {
    pub async fn run(&self, pool: &MySqlPool) -> anyhow::Result<()> {
        for id in &self.term_ids {
            sqlx::query("DELETE FROM backend_userlearningprogress WHERE term_id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await
                .ok();
            sqlx::query("DELETE FROM backend_term WHERE id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await?;
        }
        for id in &self.deck_ids {
            sqlx::query("DELETE FROM backend_userlearningprogress WHERE term_id IN (SELECT id FROM backend_term WHERE deck_id = ?)")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await
                .ok();
            sqlx::query("DELETE FROM backend_term WHERE deck_id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await?;
            sqlx::query("DELETE FROM backend_userdeckrole WHERE deck_id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await
                .ok();
            sqlx::query("UPDATE backend_user SET default_deck_id = NULL WHERE default_deck_id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await
                .ok();
            sqlx::query("DELETE FROM backend_deck WHERE id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await?;
        }
        for id in &self.folder_ids {
            sqlx::query("DELETE FROM backend_folder WHERE id = ?")
                .bind(flashlearn_server::util::db_uuid::to_mysql_char(*id))
                .execute(pool)
                .await?;
        }
        Ok(())
    }
}
