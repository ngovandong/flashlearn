from collections.abc import Iterator
from contextlib import contextmanager
from urllib.parse import quote_plus

from django.conf import settings
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine

_engines: dict[str, Engine] = {}


def _build_url() -> str:
    db = settings.DATABASES["default"]
    user = quote_plus(db["USER"])
    password = quote_plus(db["PASSWORD"] or "")
    host = db["HOST"] or "localhost"
    port = db["PORT"] or "3306"
    name = db["NAME"]
    charset = db.get("OPTIONS", {}).get("charset", "utf8")
    return f"mysql+mysqldb://{user}:{password}@{host}:{port}/{name}?charset={charset}"


def get_engine() -> Engine:
    db_name = settings.DATABASES["default"]["NAME"]
    if db_name not in _engines:
        _engines[db_name] = create_engine(_build_url(), pool_pre_ping=True)
    return _engines[db_name]


@contextmanager
def get_connection() -> Iterator[Connection]:
    conn = get_engine().connect()
    try:
        yield conn
    finally:
        conn.close()
