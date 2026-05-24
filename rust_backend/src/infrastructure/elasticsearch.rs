//! Elasticsearch HTTP queries (indices `decks`, `terms` — same as Django documents).

use crate::config::Settings;
use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::{json, Value};

pub struct ElasticsearchClient {
    base: String,
    http: Client,
}

impl ElasticsearchClient {
    pub fn new(settings: &Settings, http: Client) -> Self {
        Self {
            base: settings.elasticsearch_url.trim_end_matches('/').to_string(),
            http,
        }
    }

    pub async fn search_raw(&self, index: &str, body: Value) -> Result<Value> {
        let url = format!("{}/{}/_search", self.base, index);
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("es request")?;
        if !res.status().is_success() {
            let t = res.text().await.unwrap_or_default();
            anyhow::bail!("elasticsearch error: {t}");
        }
        Ok(res.json().await?)
    }

    /// Deck search query equivalent to `DeckViewSet.generate_q_expression`.
    pub fn deck_search_body(query: &str, user_id: &uuid::Uuid) -> Value {
        let user_id_str = user_id.to_string();
        let user_filter = json!({
            "bool": {
                "should": [
                    { "match": { "owner.id": user_id_str.clone() } },
                    { "term": { "is_public": true } },
                    {
                        "nested": {
                            "path": "users",
                            "query": { "match": { "users.id": user_id_str } }
                        }
                    }
                ],
                "minimum_should_match": 1
            }
        });
        let q = query.trim();
        if q.is_empty() {
            return json!({
                "query": user_filter,
                "size": 100
            });
        }
        let text_query = json!({
            "bool": {
                "should": [
                    {
                        "multi_match": {
                            "query": q,
                            "fields": ["owner.email", "name", "description", "owner.name^2.0"]
                        }
                    }
                ]
            }
        });
        json!({
            "query": {
                "bool": {
                    "must": [text_query, user_filter]
                }
            },
            "size": 100
        })
    }

    /// Term search body equivalent to `TermViewSet.generate_q_expression`.
    pub fn term_search_body(query: &str, deck_id: Option<&str>) -> Value {
        let mut should = vec![];
        if let Some(did) = deck_id {
            if !did.is_empty() {
                should.push(json!({ "match": { "deck_id": did } }));
            }
        }
        let q = query.trim();
        if !q.is_empty() {
            should.push(json!({
                "multi_match": {
                    "query": q,
                    "fields": ["name", "description", "deck.name"]
                }
            }));
        }
        json!({
            "query": { "bool": { "should": should } },
            "size": 100
        })
    }
}
