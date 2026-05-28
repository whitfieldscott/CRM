"""
Separate SQLite database for CannaCore OMMA/Metrc merge staging.

Does not use or modify backend/app.db or database.py.
"""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
CANNACORE_DB_PATH = BACKEND_DIR / "cannacore.db"
DATABASE_URL = f"sqlite:///{CANNACORE_DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()


def get_cannacore_db():
    """FastAPI-style dependency generator for future CannaCore routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
