import json
import logging
import os
import subprocess  # nosec B404
import tempfile
from datetime import UTC, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_TOKEN_PATH = os.getenv("DRIVE_TOKEN_PATH", "drive-token.json")
DRIVE_CREDENTIALS_PATH = os.getenv("DRIVE_CREDENTIALS_PATH", "drive-credentials.json")
DRIVE_BACKUP_FOLDER_ID = os.getenv("DRIVE_BACKUP_FOLDER_ID", "")


def _load_oauth_client():
    if not os.path.exists(DRIVE_CREDENTIALS_PATH):
        raise RuntimeError(
            f"Drive credentials not found at {DRIVE_CREDENTIALS_PATH}. "
            "Download Desktop OAuth2 credentials from Google Cloud Console."
        )

    with open(DRIVE_CREDENTIALS_PATH) as f:
        data = json.load(f)

    client = data.get("installed") or data.get("web")
    if not client:
        raise RuntimeError(f"Invalid OAuth credentials format in {DRIVE_CREDENTIALS_PATH}")

    return client["client_id"], client["client_secret"]


def _get_drive_service():
    from google.auth.exceptions import RefreshError
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    if not os.path.exists(DRIVE_TOKEN_PATH):
        raise RuntimeError(f"Drive token not found at {DRIVE_TOKEN_PATH}. Run: python manage.py setup_drive_oauth")

    try:
        with open(DRIVE_TOKEN_PATH) as f:
            token_info = json.load(f)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Drive token at {DRIVE_TOKEN_PATH} is empty or invalid. "
            "Re-authorize with: python manage.py setup_drive_oauth"
        ) from exc

    client_id, client_secret = _load_oauth_client()
    token_info["client_id"] = client_id
    token_info["client_secret"] = client_secret
    creds = Credentials.from_authorized_user_info(token_info, DRIVE_SCOPES)

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except RefreshError as exc:
            raise RuntimeError(
                "Drive token refresh failed (invalid or expired refresh token). "
                "Re-authorize with: python manage.py setup_drive_oauth. "
                "If the OAuth app is in Testing mode, publish it to Production first."
            ) from exc
        with open(DRIVE_TOKEN_PATH, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


BACKUP_RETENTION_DAYS = 15

# MySQL 8.4+ collations are not recognized by MySQL 8.0 (our local/docker target).
_COLLATION_REPLACEMENTS = {
    "utf8mb3_uca1400_ai_ci": "utf8mb3_general_ci",
    "utf8mb4_uca1400_ai_ci": "utf8mb4_unicode_ci",
    "utf8mb4_uca1400_as_ci": "utf8mb4_unicode_ci",
    "utf8mb4_uca1400_as_cs": "utf8mb4_unicode_ci",
}


def _normalize_sql_dump(sql: str) -> str:
    for old, new in _COLLATION_REPLACEMENTS.items():
        sql = sql.replace(old, new)
    return sql


def _backup_files_query():
    query = "name contains '.sql' and trashed = false"
    if DRIVE_BACKUP_FOLDER_ID:
        query += f" and '{DRIVE_BACKUP_FOLDER_ID}' in parents"
    return query


def _list_backup_files(service, *, latest_only=False):
    kwargs: dict[str, Any] = {"q": _backup_files_query(), "fields": "files(id, name, createdTime)"}
    if latest_only:
        kwargs["orderBy"] = "createdTime desc"
        kwargs["pageSize"] = 1

    response = service.files().list(**kwargs).execute()
    return response.get("files", [])


def get_latest_backup_file():
    """Return metadata for the newest .sql backup on Drive, or None if none exist."""
    service = _get_drive_service()
    files = _list_backup_files(service, latest_only=True)
    return files[0] if files else None


def _delete_old_backups(service):
    cutoff = datetime.now(UTC) - timedelta(days=BACKUP_RETENTION_DAYS)
    files = _list_backup_files(service)

    for f in files:
        created = datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00"))
        if created < cutoff:
            service.files().delete(fileId=f["id"]).execute()
            logger.info("Deleted old backup from Drive: %s (id=%s)", f["name"], f["id"])


def dump_database_to_drive():
    from django.conf import settings
    from googleapiclient.http import MediaFileUpload

    db = settings.DATABASES["default"]
    timestamp = datetime.utcnow().strftime("%y_%d_%m_%H_%M_%S")
    filename = f"{timestamp}.sql"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".sql", delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            "mysqldump",
            f"--user={db['USER']}",
            f"--password={db['PASSWORD']}",
            f"--host={db['HOST']}",
            f"--port={db.get('PORT') or '3306'}",
            "--single-transaction",
            "--routines",
            "--triggers",
            db["NAME"],
        ]
        with open(tmp_path, "w") as out:
            result = subprocess.run(cmd, stdout=out, stderr=subprocess.PIPE, text=True)  # nosec B603

        if result.returncode != 0:
            raise RuntimeError(f"mysqldump failed: {result.stderr.strip()}")

        with open(tmp_path) as f:
            normalized = _normalize_sql_dump(f.read())
        with open(tmp_path, "w") as f:
            f.write(normalized)

        service = _get_drive_service()
        _delete_old_backups(service)
        file_metadata: dict[str, Any] = {"name": filename}
        if DRIVE_BACKUP_FOLDER_ID:
            file_metadata["parents"] = [DRIVE_BACKUP_FOLDER_ID]

        media = MediaFileUpload(tmp_path, mimetype="text/plain", resumable=True)
        uploaded = service.files().create(body=file_metadata, media_body=media, fields="id,name").execute()

        logger.info("Backup uploaded to Drive: %s (id=%s)", uploaded["name"], uploaded["id"])

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _download_drive_file(service, file_id, dest_path):
    from googleapiclient.http import MediaIoBaseDownload

    request = service.files().get_media(fileId=file_id)
    with open(dest_path, "wb") as out:
        downloader = MediaIoBaseDownload(out, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def restore_database_from_drive(backup_file=None):
    from django.conf import settings

    latest = backup_file or get_latest_backup_file()
    if not latest:
        raise RuntimeError("No backup files found on Google Drive.")

    db = settings.DATABASES["default"]
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".sql", delete=False) as tmp:
            tmp_path = tmp.name

        service = _get_drive_service()
        _download_drive_file(service, latest["id"], tmp_path)
        logger.info("Downloaded backup from Drive: %s (id=%s)", latest["name"], latest["id"])

        with open(tmp_path) as f:
            sql = _normalize_sql_dump(f.read())

        cmd = [
            "mysql",
            f"--user={db['USER']}",
            f"--password={db['PASSWORD']}",
            f"--host={db['HOST']}",
            f"--port={db.get('PORT') or '3306'}",
            db["NAME"],
        ]
        result = subprocess.run(cmd, input=sql, stderr=subprocess.PIPE, text=True)  # nosec B603

        if result.returncode != 0:
            stderr = "\n".join(
                line for line in result.stderr.splitlines() if "Using a password on the command line" not in line
            )
            raise RuntimeError(f"mysql restore failed: {stderr.strip()}")

        logger.info("Database restored from Drive backup: %s", latest["name"])
        return latest

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
