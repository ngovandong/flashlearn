//! Phase 1: profile + folder + deck + term CRUD parity (legacy vs Rust).

use crate::compare::{normalize_response, sort_json_array_by_id};
use crate::db::SqlCleanup;
use crate::env::{access_token_or_login, load_dotenv, migrate_context_ready, migrate_test_inspect};
use crate::http::{delete_both, get_json_both, post_json_both, post_json_pair, put_json_both};
use reqwest::Client;
use serde_json::json;

pub async fn run_phase1_crud() -> anyhow::Result<()> {
    load_dotenv();
    if !migrate_context_ready() {
        eprintln!("skip phase1 CRUD: set LEGACY_API_BASE_URL and RUST_API_BASE_URL");
        return Ok(());
    }
    let legacy = crate::env::legacy_api_base().unwrap();
    let rust = crate::env::rust_api_base().unwrap();
    let client = Client::builder().build()?;
    let token = access_token_or_login(&client, &legacy).await?;

    let pool = crate::db::connect_pool().await.ok();
    if migrate_test_inspect() {
        if let Some(ref p) = pool {
            crate::db::print_inspect_snapshot(p).await;
        }
    }

    let mut cleanup = SqlCleanup::default();

    // --- get_profile ---
    let prof = get_json_both(
        &client,
        &legacy,
        &rust,
        "/api/users/get_profile/",
        &token,
    )
    .await?;
    assert_eq!(prof.legacy_status, prof.rust_status, "get_profile status");
    let ln = normalize_response(prof.legacy_body.clone());
    let rn = normalize_response(prof.rust_body.clone());
    assert_eq!(ln, rn, "get_profile body mismatch");

    let tag = crate::fixtures::unique_tag();
    let folder_name = crate::fixtures::folder_name(&tag);
    let folder_body = json!({
        "name": folder_name,
        "description": "migrate_test folder desc",
    });

    // --- create folder (both backends; two rows in shared DB) ---
    let folder_create = post_json_both(
        &client,
        &legacy,
        &rust,
        "/api/folders/",
        &token,
        folder_body,
    )
    .await?;
    assert_eq!(
        folder_create.legacy_status,
        folder_create.rust_status,
        "create folder status"
    );
    let ln = normalize_response(folder_create.legacy_body.clone());
    let rn = normalize_response(folder_create.rust_body.clone());
    assert_eq!(ln, rn, "create folder body");

    let folder_id_legacy = folder_create
        .legacy_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("legacy folder id");
    let folder_id_rust = folder_create
        .rust_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("rust folder id");
    cleanup.folder_ids.push(folder_id_legacy);
    cleanup.folder_ids.push(folder_id_rust);

    // --- get folder (each id on both servers) ---
    let gfolder_l = get_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_legacy}/"),
        &token,
    )
    .await?;
    assert_eq!(gfolder_l.legacy_status, gfolder_l.rust_status);
    let ln = normalize_response(gfolder_l.legacy_body);
    let rn = normalize_response(gfolder_l.rust_body);
    assert_eq!(ln, rn, "get folder legacy id");

    let gfolder_r = get_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_rust}/"),
        &token,
    )
    .await?;
    assert_eq!(gfolder_r.legacy_status, gfolder_r.rust_status);
    let ln = normalize_response(gfolder_r.legacy_body);
    let rn = normalize_response(gfolder_r.rust_body);
    assert_eq!(ln, rn, "get folder rust id");

    // --- update folder ---
    let upd_folder = json!({
        "name": format!("{folder_name}_u"),
        "description": "updated",
    });
    let folder_put_l = put_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_legacy}/"),
        &token,
        upd_folder.clone(),
    )
    .await?;
    assert_eq!(folder_put_l.legacy_status, folder_put_l.rust_status);
    let folder_put_r = put_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_rust}/"),
        &token,
        upd_folder,
    )
    .await?;
    assert_eq!(folder_put_r.legacy_status, folder_put_r.rust_status);
    let ln = normalize_response(folder_put_l.legacy_body);
    let rn = normalize_response(folder_put_r.rust_body);
    assert_eq!(ln, rn, "update folder");

    // --- deck ---
    let deck_name = crate::fixtures::deck_name(&tag);
    let deck_body = json!({
        "name": deck_name,
        "description": "d desc",
        "field": "en",
        "is_public": true,
        "background": null,
    });
    let deck_create = post_json_both(
        &client,
        &legacy,
        &rust,
        "/api/decks/",
        &token,
        deck_body,
    )
    .await?;
    assert_eq!(deck_create.legacy_status, deck_create.rust_status, "create deck");
    let ln = normalize_response(deck_create.legacy_body.clone());
    let rn = normalize_response(deck_create.rust_body.clone());
    assert_eq!(ln, rn, "create deck normalized");

    let deck_id_legacy = deck_create
        .legacy_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("legacy deck id");
    let deck_id_rust = deck_create
        .rust_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("rust deck id");
    cleanup.deck_ids.push(deck_id_legacy);
    cleanup.deck_ids.push(deck_id_rust);

    // --- term (different deck UUID per backend row) ---
    let term_name = crate::fixtures::term_name(&tag);
    let term_body_l = json!({
        "name": term_name,
        "description": "td",
        "deck": deck_id_legacy.to_string(),
        "image": null,
    });
    let term_body_r = json!({
        "name": term_name,
        "description": "td",
        "deck": deck_id_rust.to_string(),
        "image": null,
    });
    let term_created = post_json_pair(
        &client,
        &legacy,
        &rust,
        "/api/terms/",
        &token,
        term_body_l,
        term_body_r,
    )
    .await?;
    assert_eq!(
        term_created.legacy_status,
        term_created.rust_status,
        "create term status"
    );
    let ln = normalize_response(term_created.legacy_body.clone());
    let rn = normalize_response(term_created.rust_body.clone());
    assert_eq!(ln, rn, "create term normalized");

    let term_id_legacy = term_created
        .legacy_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("term legacy");
    let term_id_rust = term_created
        .rust_body
        .get("id")
        .and_then(|x| x.as_str())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .expect("term rust");
    cleanup.term_ids.push(term_id_legacy);
    cleanup.term_ids.push(term_id_rust);

    // --- list terms per deck ---
    let list_legacy_deck = get_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/?deck_id={deck_id_legacy}"),
        &token,
    )
    .await?;
    assert_eq!(
        list_legacy_deck.legacy_status,
        list_legacy_deck.rust_status,
        "list terms status (legacy deck)"
    );
    let mut la = list_legacy_deck.legacy_body.clone();
    let mut ra = list_legacy_deck.rust_body.clone();
    sort_json_array_by_id(&mut la);
    sort_json_array_by_id(&mut ra);
    assert_eq!(
        normalize_response(la),
        normalize_response(ra),
        "list terms legacy deck"
    );

    let list_rust_deck = get_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/?deck_id={deck_id_rust}"),
        &token,
    )
    .await?;
    assert_eq!(
        list_rust_deck.legacy_status,
        list_rust_deck.rust_status,
        "list terms status (rust deck)"
    );
    let mut la = list_rust_deck.legacy_body.clone();
    let mut ra = list_rust_deck.rust_body.clone();
    sort_json_array_by_id(&mut la);
    sort_json_array_by_id(&mut ra);
    assert_eq!(
        normalize_response(la),
        normalize_response(ra),
        "list terms rust deck"
    );

    // --- update term ---
    let term_put = json!({
        "name": format!("{term_name}_u"),
        "description": "td2",
        "image": null,
    });
    let tu_l = put_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/{term_id_legacy}/"),
        &token,
        term_put.clone(),
    )
    .await?;
    let tu_r = put_json_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/{term_id_rust}/"),
        &token,
        term_put,
    )
    .await?;
    assert_eq!(tu_l.legacy_status, tu_r.rust_status);
    let ln = normalize_response(tu_l.legacy_body);
    let rn = normalize_response(tu_r.rust_body);
    assert_eq!(ln, rn, "update term");

    // --- delete term ---
    let (ds_l, ds_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/{term_id_legacy}/"),
        &token,
    )
    .await?;
    assert_eq!(ds_l, ds_r);
    let (ds2_l, ds2_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/terms/{term_id_rust}/"),
        &token,
    )
    .await?;
    assert_eq!(ds2_l, ds2_r);
    cleanup.term_ids.clear();

    // --- delete deck ---
    let (dd_l, dd_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/decks/{deck_id_legacy}/"),
        &token,
    )
    .await?;
    assert_eq!(dd_l, dd_r);
    let (dd2_l, dd2_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/decks/{deck_id_rust}/"),
        &token,
    )
    .await?;
    assert_eq!(dd2_l, dd2_r);
    cleanup.deck_ids.clear();

    // --- delete folder ---
    let (df_l, df_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_legacy}/"),
        &token,
    )
    .await?;
    assert_eq!(df_l, df_r);
    let (df2_l, df2_r) = delete_both(
        &client,
        &legacy,
        &rust,
        &format!("/api/folders/{folder_id_rust}/"),
        &token,
    )
    .await?;
    assert_eq!(df2_l, df2_r);
    cleanup.folder_ids.clear();

    if let Some(ref p) = pool {
        let _ = cleanup.run(p).await;
    }

    Ok(())
}
