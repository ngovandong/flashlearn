import json
import logging
import os
import subprocess  # nosec B404
import tempfile
from datetime import UTC, datetime, timedelta

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

    with open(DRIVE_TOKEN_PATH) as f:
        token_info = json.load(f)

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


def _delete_old_backups(service):
    cutoff = datetime.now(UTC) - timedelta(days=BACKUP_RETENTION_DAYS)

    query = "name contains '.sql' and trashed = false"
    if DRIVE_BACKUP_FOLDER_ID:
        query += f" and '{DRIVE_BACKUP_FOLDER_ID}' in parents"

    response = service.files().list(q=query, fields="files(id, name, createdTime)").execute()
    files = response.get("files", [])

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

        service = _get_drive_service()
        _delete_old_backups(service)
        file_metadata = {"name": filename}
        if DRIVE_BACKUP_FOLDER_ID:
            file_metadata["parents"] = [DRIVE_BACKUP_FOLDER_ID]

        media = MediaFileUpload(tmp_path, mimetype="text/plain", resumable=True)
        uploaded = service.files().create(body=file_metadata, media_body=media, fields="id,name").execute()

        logger.info("Backup uploaded to Drive: %s (id=%s)", uploaded["name"], uploaded["id"])

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
