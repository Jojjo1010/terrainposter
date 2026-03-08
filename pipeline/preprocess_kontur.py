"""Preprocess Kontur population data into multi-resolution GeoTIFFs.

Reads a Kontur population GeoPackage (potentially very large, ~6 GB) in
chunks and rasterizes at 1 km, 5 km, and 20 km resolutions.

Usage::

    python preprocess_kontur.py --input /data/kontur_pop.gpkg --output-dir ../data/processed/
    python preprocess_kontur.py --input /data/kontur_pop.gpkg --bbox "55,70,10,25"
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import click
import geopandas as gpd
import numpy as np
from shapely.geometry import box
from tqdm import tqdm

from utils import create_overview_pyramids, hex_to_raster

logger = logging.getLogger(__name__)

RESOLUTIONS_KM = [1, 5, 20]
CHUNK_SIZE = 500_000


def _parse_bbox(bbox_str: str) -> dict:
    """Parse a comma-separated bbox string 'south,north,west,east' into a dict."""
    parts = [float(p.strip()) for p in bbox_str.split(",")]
    if len(parts) != 4:
        raise click.BadParameter(
            "bbox must have exactly 4 values: south,north,west,east"
        )
    return {"south": parts[0], "north": parts[1], "west": parts[2], "east": parts[3]}


def _read_gpkg_chunked(
    input_path: Path,
    bbox_filter: Optional[dict],
) -> gpd.GeoDataFrame:
    """Read a GeoPackage in chunks, optionally filtering by bounding box.

    Yields chunks as GeoDataFrames and then concatenates.  This avoids
    loading the entire file at once.

    Parameters
    ----------
    input_path : Path
        Path to the Kontur ``.gpkg`` file.
    bbox_filter : dict or None
        Optional bounding box with keys south, north, west, east.

    Returns
    -------
    gpd.GeoDataFrame
        The (optionally filtered) dataset.
    """
    # Determine total row count for progress reporting.
    # fiona can count features without loading geometry.
    import fiona

    with fiona.open(input_path) as src:
        total_rows = len(src)

    chunks: list[gpd.GeoDataFrame] = []
    rows_read = 0

    pbar = tqdm(total=total_rows, desc="Reading GeoPackage", unit="rows")

    while rows_read < total_rows:
        chunk = gpd.read_file(
            input_path,
            rows=slice(rows_read, rows_read + CHUNK_SIZE),
        )

        if chunk.empty:
            break

        # Apply bounding box filter if provided.
        if bbox_filter is not None:
            bbox_geom = box(
                bbox_filter["west"],
                bbox_filter["south"],
                bbox_filter["east"],
                bbox_filter["north"],
            )
            chunk = chunk[chunk.geometry.intersects(bbox_geom)]

        if not chunk.empty:
            chunks.append(chunk)

        rows_read += CHUNK_SIZE
        pbar.update(min(CHUNK_SIZE, total_rows - (rows_read - CHUNK_SIZE)))

    pbar.close()

    if not chunks:
        raise click.ClickException(
            "No data found after reading and filtering. Check input file and bbox."
        )

    return gpd.pd.concat(chunks, ignore_index=True)


@click.command()
@click.option(
    "--input",
    "input_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Path to the Kontur population GeoPackage (.gpkg).",
)
@click.option(
    "--output-dir",
    default="../data/processed/",
    type=click.Path(file_okay=False, path_type=Path),
    show_default=True,
    help="Directory for output GeoTIFFs.",
)
@click.option(
    "--bbox",
    default=None,
    type=str,
    help='Bounding box as "south,north,west,east" (e.g. "55,70,10,25" for Sweden).',
)
def main(input_path: Path, output_dir: Path, bbox: Optional[str]) -> None:
    """Preprocess Kontur population data into multi-resolution rasters."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    bbox_filter = _parse_bbox(bbox) if bbox else None

    logger.info("Reading %s (chunk size: %d rows)", input_path, CHUNK_SIZE)
    gdf = _read_gpkg_chunked(input_path, bbox_filter)
    logger.info("Loaded %d features", len(gdf))

    # Ensure CRS is EPSG:4326.
    if gdf.crs is not None and not gdf.crs.equals("EPSG:4326"):
        logger.info("Reprojecting from %s to EPSG:4326", gdf.crs)
        gdf = gdf.to_crs("EPSG:4326")

    for res_km in tqdm(RESOLUTIONS_KM, desc="Resolutions"):
        resolution_m = res_km * 1000
        output_path = output_dir / f"kontur_pop_{res_km}km.tif"

        logger.info("Rasterizing at %d km (%d m) resolution", res_km, resolution_m)
        hex_to_raster(
            gdf,
            resolution_m=resolution_m,
            output_path=output_path,
            value_column="population",
        )

        logger.info("Building overview pyramids for %s", output_path.name)
        create_overview_pyramids(output_path)

        logger.info("Wrote %s", output_path)

    click.echo("Done. Output files:")
    for res_km in RESOLUTIONS_KM:
        click.echo(f"  {output_dir / f'kontur_pop_{res_km}km.tif'}")


if __name__ == "__main__":
    main()
