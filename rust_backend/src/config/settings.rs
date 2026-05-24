use std::time::Duration;

use anyhow::{Context, Result};
use chrono_tz::Tz;
use uuid::Uuid;

/// All runtime settings loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Settings {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub skip_redis: bool,
    pub elasticsearch_url: String,
    pub secret_key: String,
    pub jwt_access_lifetime: Duration,
    pub jwt_refresh_lifetime: Duration,
    pub jwt_algorithm: jsonwebtoken::Algorithm,
    pub cors_allow_all: bool,
    pub cors_allowed_origins: Vec<String>,
    pub base_frontend_url: String,
    pub base_backend_url: String,
    pub google_oauth_client_id: String,
    pub google_oauth_client_secret: String,
    pub cloudinary_cloud_name: String,
    pub cloudinary_api_key: String,
    pub cloudinary_api_secret: String,
    pub email_smtp_host: Option<String>,
    pub email_smtp_port: Option<u16>,
    pub email_user: Option<String>,
    pub email_password: Option<String>,
    pub email_from: Option<String>,
    pub app_timezone: Tz,
    pub rest_page_size: u32,
    pub learning_progress_cache_ttl_secs: u64,
    pub user_cache_ttl_secs: Option<u64>,
    /// Django `PBKDF2PasswordHasher` iterations (must match when creating new passwords).
    pub pbkdf2_iterations: u32,
}

fn env_var(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("missing environment variable: {key}"))
}

fn env_optional(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|s| !s.is_empty())
}

impl Settings {
    /// Resolve MySQL URL the same way as [`Self::from_env`] (for migrate tests and tooling).
    pub fn database_url_from_env() -> Result<String> {
        env_optional("DATABASE_URL")
            .or_else(|| {
                let user = std::env::var("DB_USER").ok()?;
                let pass = std::env::var("DB_PASSWORD").ok()?;
                let host = std::env::var("DB_HOST").ok()?;
                let port = std::env::var("DB_PORT").ok()?;
                let name = std::env::var("DB_NAME").ok()?;
                Some(format!("mysql://{user}:{pass}@{host}:{port}/{name}"))
            })
            .context("set DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME")
    }

    pub fn from_env() -> Result<Self> {
        let tz_name = env_optional("APP_TIMEZONE").unwrap_or_else(|| "Asia/Ho_Chi_Minh".into());
        let app_timezone: Tz = tz_name
            .parse()
            .map_err(|_| anyhow::anyhow!("invalid APP_TIMEZONE: {tz_name}"))?;

        let cors_allowed_origins = env_optional("CORS_ALLOWED_ORIGINS")
            .map(|s| s.split(',').map(|x| x.trim().to_string()).collect())
            .unwrap_or_else(|| vec!["http://localhost:3000".into()]);

        Ok(Self {
            host: env_optional("BIND_HOST").unwrap_or_else(|| "0.0.0.0".into()),
            port: env_optional("PORT")
                .or_else(|| env_optional("SERVER_PORT"))
                .and_then(|s| s.parse().ok())
                .unwrap_or(8005),
            database_url: Self::database_url_from_env()?,
            redis_url: env_optional("REDIS_URL").unwrap_or_else(|| {
                let host = env_optional("REDIS_HOST").unwrap_or_else(|| "127.0.0.1".into());
                let port = env_optional("REDIS_PORT").unwrap_or_else(|| "6379".into());
                format!("redis://{host}:{port}/")
            }),
            skip_redis: env_optional("SKIP_REDIS").map(|v| v == "True" || v == "true" || v == "1").unwrap_or(false),
            elasticsearch_url: {
                let host = env_optional("ELASTIC_SEARCH_HOST").unwrap_or_else(|| "localhost".into());
                let port = env_optional("ELASTIC_SEARCH_PORT").unwrap_or_else(|| "9200".into());
                env_optional("ELASTICSEARCH_URL")
                    .unwrap_or_else(|| format!("http://{host}:{port}"))
            },
            secret_key: env_var("SECRET_KEY")?,
            jwt_access_lifetime: Duration::from_secs(
                env_optional("JWT_ACCESS_LIFETIME_SECS")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30 * 60),
            ),
            jwt_refresh_lifetime: Duration::from_secs(
                env_optional("JWT_REFRESH_LIFETIME_SECS")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30 * 24 * 3600),
            ),
            jwt_algorithm: jsonwebtoken::Algorithm::HS256,
            cors_allow_all: env_optional("CORS_ALLOW_ALL_ORIGINS")
                .map(|v| v == "True" || v == "true" || v == "1")
                .unwrap_or(false),
            cors_allowed_origins,
            base_frontend_url: env_optional("BASE_FRONTEND_URL")
                .unwrap_or_else(|| "http://localhost:3000".into()),
            base_backend_url: env_optional("BASE_BACKEND_URL")
                .unwrap_or_else(|| "http://localhost:8005".into()),
            google_oauth_client_id: env_optional("GOOGLE_OAUTH2_CLIENT_ID").unwrap_or_default(),
            google_oauth_client_secret: env_optional("GOOGLE_OAUTH2_CLIENT_SECRET").unwrap_or_default(),
            cloudinary_cloud_name: env_optional("CLOUDINARY_CLOUD_NAME").unwrap_or_default(),
            cloudinary_api_key: env_optional("CLOUDINARY_API_KEY").unwrap_or_default(),
            cloudinary_api_secret: env_optional("CLOUDINARY_API_SECRET").unwrap_or_default(),
            email_smtp_host: env_optional("EMAIL_SMTP_HOST"),
            email_smtp_port: env_optional("EMAIL_SMTP_PORT").and_then(|s| s.parse().ok()),
            email_user: env_optional("EMAIL_HOST_USER"),
            email_password: env_optional("EMAIL_HOST_PASSWORD"),
            email_from: env_optional("EMAIL_FROM"),
            app_timezone,
            rest_page_size: env_optional("REST_PAGE_SIZE")
                .and_then(|s| s.parse().ok())
                .unwrap_or(20),
            learning_progress_cache_ttl_secs: env_optional("LEARNING_PROGRESS_CACHE_TTL_SECS")
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
            user_cache_ttl_secs: env_optional("USER_CACHE_TTL_SECS").and_then(|s| s.parse().ok()),
            pbkdf2_iterations: env_optional("PBKDF2_ITERATIONS")
                .and_then(|s| s.parse().ok())
                .unwrap_or(600_000),
        })
    }

    pub fn invite_signing_key_bytes(&self) -> Vec<u8> {
        self.secret_key.as_bytes().to_vec()
    }

    /// Public user id for JWT `user_id` claim (Django emits string UUID).
    pub fn jwt_user_id(user_id: Uuid) -> serde_json::Value {
        serde_json::Value::String(user_id.to_string())
    }
}
