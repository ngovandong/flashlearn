//! MySQL connection pool (`sqlx`).

use crate::config::Settings;
use anyhow::Result;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;

#[derive(Clone)]
pub struct Database {
    pub pool: MySqlPool,
}

impl Database {
    pub async fn connect(settings: &Settings) -> Result<Self> {
        let pool = MySqlPoolOptions::new()
            .max_connections(10)
            .connect(&settings.database_url)
            .await?;
        Ok(Self { pool })
    }
}
