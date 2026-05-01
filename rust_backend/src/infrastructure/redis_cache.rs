//! Redis cache mirroring `core/cache.py` + `backend/services/cache.py`.

use crate::config::Settings;
use anyhow::Context;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct RedisCache {
    conn: ConnectionManager,
    settings: std::sync::Arc<Settings>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LearningProgressCached {
    pub deck_term_count: i64,
    pub progress: serde_json::Value,
}

impl RedisCache {
    pub fn new(conn: ConnectionManager, settings: &std::sync::Arc<Settings>) -> Self {
        Self {
            conn,
            settings: std::sync::Arc::clone(settings),
        }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
    ) -> anyhow::Result<Option<T>> {
        let mut c = self.conn.clone();
        let v: Option<String> = c.get(key).await.context("redis get")?;
        match v {
            Some(s) => Ok(Some(serde_json::from_str(&s).context("json decode")?)),
            None => Ok(None),
        }
    }

    async fn set_json<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> anyhow::Result<()> {
        let mut c = self.conn.clone();
        let s = serde_json::to_string(value).context("json encode")?;
        if let Some(ttl) = ttl_secs {
            c.set_ex::<_, _, ()>(key, s, ttl)
                .await
                .context("redis set_ex")?;
        } else {
            c.set::<_, _, ()>(key, s).await.context("redis set")?;
        }
        Ok(())
    }

    async fn delete_key(&self, key: &str) -> anyhow::Result<()> {
        let mut c = self.conn.clone();
        c.del::<_, ()>(key).await.context("redis del")?;
        Ok(())
    }

    pub async fn cache_user_json(
        &self,
        user_id: &uuid::Uuid,
        json: &serde_json::Value,
    ) -> anyhow::Result<()> {
        let key = format!("user_{user_id}");
        self.set_json(&key, json, self.settings.user_cache_ttl_secs)
            .await
    }

    pub async fn get_user_json(
        &self,
        user_id: &uuid::Uuid,
    ) -> anyhow::Result<Option<serde_json::Value>> {
        let key = format!("user_{user_id}");
        self.get_json(&key).await
    }

    pub async fn delete_user_cache(&self, user_id: &uuid::Uuid) -> anyhow::Result<()> {
        let key = format!("user_{user_id}");
        self.delete_key(&key).await
    }

    pub fn learning_progress_key(deck_id: &uuid::Uuid, user_id: &uuid::Uuid) -> String {
        format!("learning_progress_{deck_id}_{user_id}")
    }

    pub async fn get_learning_progress_cached(
        &self,
        deck_id: &uuid::Uuid,
        user_id: &uuid::Uuid,
    ) -> anyhow::Result<Option<LearningProgressCached>> {
        let key = Self::learning_progress_key(deck_id, user_id);
        self.get_json(&key).await
    }

    pub async fn set_learning_progress_cached(
        &self,
        deck_id: &uuid::Uuid,
        user_id: &uuid::Uuid,
        value: &LearningProgressCached,
    ) -> anyhow::Result<()> {
        let key = Self::learning_progress_key(deck_id, user_id);
        let ttl = self.settings.learning_progress_cache_ttl_secs;
        self.set_json(&key, value, Some(ttl)).await
    }

    pub async fn delete_learning_progress_cached(
        &self,
        deck_id: &uuid::Uuid,
        user_id: &uuid::Uuid,
    ) -> anyhow::Result<()> {
        let key = Self::learning_progress_key(deck_id, user_id);
        self.delete_key(&key).await
    }
}
