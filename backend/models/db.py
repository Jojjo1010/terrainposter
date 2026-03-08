from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    resolution_km = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    bbox = Column(Geometry("Polygon", srid=4326))
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("name", "resolution_km", name="uq_dataset_name_resolution"),
    )


def get_db():
    """FastAPI dependency that yields a database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
