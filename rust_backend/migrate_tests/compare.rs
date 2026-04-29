//! Normalize JSON for semantic parity between Django and Rust responses.

use serde_json::Value;

const STRIP_ANYWHERE: &[&str] = &["created_at", "updated_at"];

/// Remove volatile keys: timestamps everywhere; `id` on the response root and on each object in a top-level array.
pub fn normalize_response(v: Value) -> Value {
    match v {
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|mut item| {
                    if let Value::Object(m) = &mut item {
                        m.remove("id");
                    }
                    strip_recursive(&mut item);
                    item
                })
                .collect(),
        ),
        Value::Object(mut m) => {
            m.remove("id");
            m.retain(|k, _| !STRIP_ANYWHERE.contains(&k.as_str()));
            let mut obj = Value::Object(m);
            strip_recursive(&mut obj);
            obj
        }
        other => other,
    }
}

fn strip_recursive(v: &mut Value) {
    match v {
        Value::Object(m) => {
            m.retain(|k, _| !STRIP_ANYWHERE.contains(&k.as_str()));
            for (_, child) in m.iter_mut() {
                strip_recursive(child);
            }
        }
        Value::Array(a) => {
            for item in a.iter_mut() {
                strip_recursive(item);
            }
        }
        _ => {}
    }
}

/// Normalize list responses by sorting objects with an `id` field (string) for stable comparison.
pub fn sort_json_array_by_id(v: &mut Value) {
    if let Value::Array(items) = v {
        items.sort_by(|a, b| {
            let ia = a.get("id").and_then(|x| x.as_str()).unwrap_or("");
            let ib = b.get("id").and_then(|x| x.as_str()).unwrap_or("");
            ia.cmp(ib)
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn strips_root_and_array_item_ids() {
        let j = json!([
            {"id": "t1", "name": "a"},
            {"id": "t2", "name": "b"}
        ]);
        let n = normalize_response(j);
        assert!(n[0].get("id").is_none());
        assert_eq!(n[0]["name"], "a");
    }

    #[test]
    fn strips_timestamps_on_object() {
        let j = json!({
            "id": "abc",
            "name": "n",
            "created_at": "x",
            "owner": { "id": "u1", "email": "e" }
        });
        let n = normalize_response(j);
        assert!(n.get("id").is_none());
        assert!(n.get("created_at").is_none());
        assert_eq!(n["owner"]["id"], "u1");
        assert_eq!(n["name"], "n");
    }
}
