"""Register processed GeoTIFF datasets in a PostGIS database.

Scans an output directory for ``.tif`` files, reads their bounding boxes
with rasterio, and upserts metadata into a ``datasets`` table.

Usage::

    python load_postgis.py --data-dir ../data/processed/
    python load_postgis.py --db-url postgresql://user:pass@host:5432/terrain
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import click
import rasterio
from shapely.geometry import box
from geoalchemy2 import Geometry, WKTElement
from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()

DEFAULT_DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://localhost:5432/terrainposter"
)


class Dataset(Base):  # type: ignore[misc]
    """SQLAlchemy model for the ``datasets`` table."""

    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    resolution_km = Column(Integer, nullable=False)
    file_path = Column(Text, nullable=False)
    bbox = Column(Geometry("POLYGON", srid=4326))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("name", "resolution_km", name="uq_name_resolution"),
        Index("idx_datasets_bbox", "bbox", postgresql_using="gist"),
    )


def _parse_filename(filename: str) -> tuple[str, int] | None:
    """Extract dataset name and resolution from a filename.

    Expected patterns:
        kontur_pop_5km.tif  -> ("kontur_pop", 5)
        viirs_nightlights_20km.tif -> ("viirs_nightlights", 20)

    Returns None if the filename does not match.
    """
    stem = Path(filename).stem  # e.g. "kontur_pop_5km"
    parts = stem.rsplit("_", 1)
    if len(parts) != 2:
        return None
    name, res_str = parts
    if not res_str.endswith("km"):
        return None
    try:
        resolution_km = int(res_str[:-2])
    except ValueError:
        return None
    return name, resolution_km


def _get_bbox_wkt(tif_path: Path) -> str:
    """Read a GeoTIFF's bounds and return a WKT polygon string."""
    with rasterio.open(tif_path) as src:
        b = src.bounds
    polygon = box(b.left, b.bottom, b.right, b.top)
    return polygon.wkt


def _ensure_postgis(engine) -> None:
    """Enable the PostGIS extension if not already present."""
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))


@click.command()
@click.option(
    "--data-dir",
    default="../data/processed/",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    show_default=True,
    help="Directory containing processed GeoTIFF files.",
)
@click.option(
    "--db-url",
    default=DEFAULT_DB_URL,
    show_default=True,
    help="PostgreSQL connection string (or set DATABASE_URL env var).",
)
def main(data_dir: Path, db_url: str) -> None:
    """Register processed raster datasets in PostGIS."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    data_dir = data_dir.resolve()
    tif_files = sorted(data_dir.glob("*.tif"))

    if not tif_files:
        raise click.ClickException(f"No .tif files found in {data_dir}")

    logger.info("Found %d GeoTIFF files in %s", len(tif_files), data_dir)

    engine = create_engine(db_url)
    _ensure_postgis(engine)

    # Create table if it does not exist.
    Base.metadata.create_all(engine)

    registered = 0

    with Session(engine) as session:
        for tif_path in tif_files:
            parsed = _parse_filename(tif_path.name)
            if parsed is None:
                logger.warning(
                    "Skipping %s (filename does not match expected pattern)",
                    tif_path.name,
                )
                continue

            name, resolution_km = parsed
            bbox_wkt = _get_bbox_wkt(tif_path)

            stmt = pg_insert(Dataset.__table__).values(
                name=name,
                resolution_km=resolution_km,
                file_path=str(tif_path),
                bbox=WKTElement(bbox_wkt, srid=4326),
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_name_resolution",
                set_={
                    "file_path": stmt.excluded.file_path,
                    "bbox": stmt.excluded.bbox,
                    "created_at": func.now(),
                },
            )
            session.execute(stmt)
            registered += 1
            logger.info("Registered %s @ %d km", name, resolution_km)

        session.commit()

    click.echo(f"\nRegistered {registered} dataset(s) in PostGIS:")
    click.echo(f"  Database: {db_url}")
    click.echo(f"  Table:    datasets")
    for tif_path in tif_files:
        parsed = _parse_filename(tif_path.name)
        if parsed:
            name, res = parsed
            click.echo(f"  - {name} @ {res} km  ({tif_path.name})")


if __name__ == "__main__":
    main()
