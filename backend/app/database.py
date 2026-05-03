from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings
from pymysql.constants import CLIENT


class Base(DeclarativeBase):
    pass


def _engine():
    settings = get_settings()
    url = settings.database_url or ""
    connect_args: dict = {}
    if url.startswith("mysql"):
        connect_args["client_flag"] = CLIENT.FOUND_ROWS
        ca = (getattr(settings, "database_ssl_ca", "") or "").strip()
        if ca:
            connect_args["ssl"] = {"ca": ca}
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args=connect_args,
    )


engine = _engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
