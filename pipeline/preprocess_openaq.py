"""Preprocess OpenAQ air quality point data into gridded GeoTIFFs.

Reads a CSV export with lat/lon/value columns, interpolates onto a regular
grid using linear interpolation, and outputs rasters at 5 km and 20 km.

Usage::

    python preprocess_openaq.py --input /data/openaq_export.csv --output-dir ../data/processed/
"""

from __future__ import annotations

import logging
from pathlib import Path

import click
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_bounds
from scipy.interpolate import griddata

from utils import create_overview_pyramids, METERS_PER_DEGREE

logger = logging.getLogger(__name__)

# 1 km is too fine for sparse point data.
RESOLUTIONS_KM = [5, 20]


def _interpolate_to_raster(
    df: pd.DataFrame,
    resolution_m: float,
    output_path: Path,
    lat_col: str = "lat",
    lon_col: str = "lon",
    value_col: str = "value",
) -> Path:
    """Interpolate point observations onto a regular grid and write a GeoTIFF.

    Parameters
    ----------
    df : pd.DataFrame
        Input point data with latitude, longitude, and value columns.
    resolution_m : float
        Grid cell size in meters (converted to degrees internally).
    output_path : Path
        Output GeoTIFF path.
    lat_col, lon_col, value_col : str
        Column names for coordinates and the measured value.

    Returns
    -------
    Path
        The path to the written GeoTIFF.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pixel_size_deg = resolution_m / METERS_PER_DEGREE

    lats = df[lat_col].values
    lons = df[lon_col].values
    values = df[value_col].values

    # Define grid extent with a small buffer so edge points are included.
    buffer = pixel_size_deg * 2
    west = lons.min() - buffer
    east = lons.max() + buffer
    south = lats.min() - buffer
    north = lats.max() + buffer

    width = max(1, int(np.ceil((east - west) / pixel_size_deg)))
    height = max(1, int(np.ceil((north - south) / pixel_size_deg)))

    # Build target grid coordinates (cell centres).
    grid_lon = np.linspace(west + pixel_size_deg / 2, east - pixel_size_deg / 2, width)
    grid_lat = np.linspace(north - pixel_size_deg / 2, south + pixel_size_deg / 2, height)
    grid_lon_2d, grid_lat_2d = np.meshgrid(grid_lon, grid_lat)

    logger.info(
        "Interpolating %d points onto %d x %d grid", len(df), width, height
    )

    interpolated = griddata(
        points=np.column_stack([lons, lats]),
        values=values,
        xi=(grid_lon_2d, grid_lat_2d),
        method="linear",
        fill_value=0.0,
    ).astype("float32")

    transform = from_bounds(west, south, east, north, width, height)

    profile = {
        "driver": "GTiff",
        "dtype": "float32",
        "width": width,
        "height": height,
        "count": 1,
        "crs": "EPSG:4326",
        "transform": transform,
        "nodata": 0,
        "compress": "deflate",
    }

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(interpolated, 1)

    return output_path


@click.command()
@click.option(
    "--input",
    "input_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Path to the OpenAQ CSV export (must have lat, lon, value columns).",
)
@click.option(
    "--output-dir",
    default="../data/processed/",
    type=click.Path(file_okay=False, path_type=Path),
    show_default=True,
    help="Directory for output GeoTIFFs.",
)
@click.option(
    "--lat-col",
    default="lat",
    show_default=True,
    help="Name of the latitude column in the CSV.",
)
@click.option(
    "--lon-col",
    default="lon",
    show_default=True,
    help="Name of the longitude column in the CSV.",
)
@click.option(
    "--value-col",
    default="value",
    show_default=True,
    help="Name of the measurement value column in the CSV.",
)
def main(
    input_path: Path,
    output_dir: Path,
    lat_col: str,
    lon_col: str,
    value_col: str,
) -> None:
    """Preprocess OpenAQ air quality data into gridded rasters."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Reading CSV from %s", input_path)
    df = pd.read_csv(input_path)

    required_cols = {lat_col, lon_col, value_col}
    missing = required_cols - set(df.columns)
    if missing:
        raise click.ClickException(
            f"Missing required columns in CSV: {', '.join(sorted(missing))}"
        )

    # Drop rows with missing coordinates or values.
    initial_count = len(df)
    df = df.dropna(subset=[lat_col, lon_col, value_col])
    if len(df) < initial_count:
        logger.warning(
            "Dropped %d rows with missing values", initial_count - len(df)
        )

    if df.empty:
        raise click.ClickException("No valid data points after cleaning.")

    logger.info("Processing %d data points", len(df))

    for res_km in RESOLUTIONS_KM:
        resolution_m = res_km * 1000
        output_path = output_dir / f"openaq_airquality_{res_km}km.tif"

        logger.info("Creating %d km resolution raster", res_km)
        _interpolate_to_raster(
            df,
            resolution_m=resolution_m,
            output_path=output_path,
            lat_col=lat_col,
            lon_col=lon_col,
            value_col=value_col,
        )

        logger.info("Building overview pyramids for %s", output_path.name)
        create_overview_pyramids(output_path)

        logger.info("Wrote %s", output_path)

    click.echo("Done. Output files:")
    for res_km in RESOLUTIONS_KM:
        click.echo(f"  {output_dir / f'openaq_airquality_{res_km}km.tif'}")


if __name__ == "__main__":
    main()
