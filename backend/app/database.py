from pathlib import Path
import sqlite3

from .models import (
    DOSE_LOGS_TABLE_SQL,
    LEAFLET_UPLOADS_TABLE_SQL,
    MEDICATIONS_TABLE_SQL,
    SCHEDULES_TABLE_SQL,
)


def sqlite_path_from_url(database_url: str) -> str:
    if database_url == "sqlite:///:memory:":
        return ":memory:"

    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError("Only sqlite:/// database URLs are supported for the MVP.")

    raw_path = database_url.removeprefix(prefix)
    path = Path(raw_path)
    if path.is_absolute():
        return str(path)

    return str(Path.cwd() / path)


def get_connection(database_url: str) -> sqlite3.Connection:
    database_path = sqlite_path_from_url(database_url)
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(database_url: str) -> None:
    database_path = sqlite_path_from_url(database_url)
    if database_path != ":memory:":
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    with get_connection(database_url) as connection:
        connection.execute(MEDICATIONS_TABLE_SQL)
        connection.execute(SCHEDULES_TABLE_SQL)
        connection.execute(DOSE_LOGS_TABLE_SQL)
        connection.execute(LEAFLET_UPLOADS_TABLE_SQL)
        connection.commit()
