from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings
from pymysql.constants import CLIENT


class Base(DeclarativeBase):
    pass


def _engine():
    settings = get_settings()
    url = settings.database_url or ""
    connect_args = None
    if url.startswith("mysql"):
        connect_args = {"client_flag": CLIENT.FOUND_ROWS}
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args=connect_args or {},
    )


engine = _engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
