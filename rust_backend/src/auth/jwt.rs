//! JWT compatible with `djangorestframework-simplejwt` (HS256, `user_id` claim).

use crate::config::Settings;
use anyhow::{anyhow, Context, Result};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessClaims {
    pub token_type: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
    pub user_id: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub token_type: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
    pub user_id: serde_json::Value,
    #[serde(default)]
    pub user: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteClaims {
    pub deck_id: Uuid,
    pub role: String,
}

pub struct TokenPair {
    pub access: String,
    pub refresh: String,
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn new_jti() -> String {
    Uuid::new_v4().to_string()
}

pub fn issue_token_pair(
    settings: &Settings,
    user_id: impl Into<Uuid>,
    user_json: serde_json::Value,
) -> Result<TokenPair> {
    let user_id = user_id.into();
    let key = &settings.secret_key;
    let enc = EncodingKey::from_secret(key.as_bytes());
    let iat = now_ts();
    let access_exp = iat + settings.jwt_access_lifetime.as_secs() as i64;
    let refresh_exp = iat + settings.jwt_refresh_lifetime.as_secs() as i64;
    let access_claims = AccessClaims {
        token_type: "access".into(),
        exp: access_exp,
        iat,
        jti: new_jti(),
        user_id: json!(user_id.to_string()),
    };
    let refresh_claims = RefreshClaims {
        token_type: "refresh".into(),
        exp: refresh_exp,
        iat,
        jti: new_jti(),
        user_id: json!(user_id.to_string()),
        user: Some(user_json),
    };
    let mut header = Header::default();
    header.alg = settings.jwt_algorithm;
    let access = encode(&header, &access_claims, &enc).context("encode access jwt")?;
    let refresh = encode(&header, &refresh_claims, &enc).context("encode refresh jwt")?;
    Ok(TokenPair { access, refresh })
}

pub fn verify_access_token(settings: &Settings, token: &str) -> Result<AccessClaims> {
    let key = DecodingKey::from_secret(settings.secret_key.as_bytes());
    let mut val = Validation::new(settings.jwt_algorithm);
    val.validate_exp = true;
    val.required_spec_claims.insert("exp".into());
    let data = decode::<AccessClaims>(token, &key, &val).context("decode access jwt")?;
    if data.claims.token_type != "access" {
        return Err(anyhow!("not an access token"));
    }
    Ok(data.claims)
}

pub fn verify_refresh_token(settings: &Settings, token: &str) -> Result<RefreshClaims> {
    let key = DecodingKey::from_secret(settings.secret_key.as_bytes());
    let mut val = Validation::new(settings.jwt_algorithm);
    val.validate_exp = true;
    let data = decode::<RefreshClaims>(token, &key, &val).context("decode refresh jwt")?;
    if data.claims.token_type != "refresh" {
        return Err(anyhow!("not a refresh token"));
    }
    Ok(data.claims)
}

pub fn encode_invite_token(settings: &Settings, deck_id: Uuid, role: &str) -> Result<String> {
    let enc = EncodingKey::from_secret(settings.secret_key.as_bytes());
    let mut header = Header::default();
    header.alg = settings.jwt_algorithm;
    let claims = InviteClaims {
        deck_id,
        role: role.into(),
    };
    encode(&header, &claims, &enc).context("encode invite jwt")
}

pub fn verify_invite_token(settings: &Settings, token: &str) -> Result<InviteClaims> {
    let key = DecodingKey::from_secret(settings.secret_key.as_bytes());
    let mut val = Validation::new(settings.jwt_algorithm);
    val.validate_exp = false;
    let data = decode::<InviteClaims>(token, &key, &val).context("decode invite jwt")?;
    Ok(data.claims)
}
