//! Shared application state (dependency injection root).

use crate::config::Settings;
use crate::infrastructure::database::Database;
use crate::infrastructure::redis_cache::RedisCache;
use anyhow::Result;
use redis::aio::ConnectionManager;
use reqwest::Client;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<Settings>,
    pub db: Database,
    pub redis: Option<RedisCache>,
    pub http: Client,
}

impl AppState {
    pub async fn new(settings: Arc<Settings>, db: Database) -> Result<Self> {
        let http = Client::builder()
            .user_agent(concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION")))
            .build()?;

        let redis = if settings.skip_redis {
            None
        } else {
            let client = redis::Client::open(settings.redis_url.as_str())?;
            let conn = ConnectionManager::new(client).await?;
            Some(RedisCache::new(conn, &settings))
        };

        Ok(Self {
            settings,
            db,
            redis,
            http,
        })
    }
}
