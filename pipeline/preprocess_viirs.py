"""Preprocess VIIRS nighttime lights annual composite into multi-resolution GeoTIFFs.

The input VIIRS data is already rasterized. This script reprojects to
EPSG:4326 (if needed), resamples to 1 km / 5 km / 20 km, and applies
log scaling.

Usage::

    python preprocess_viirs.py --input /data/viirs_annual.tif --output-dir ../data/processed/
"""

from __future__ import annotations

import logging
from pathlib import Path

import click
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import calculate_default_transform, reproject

from utils import create_overview_pyramids, log_scale_raster, METERS_PER_DEGREE

logger = logging.getLogger(__name__)

RESOLUTIONS_KM = [1, 5, 20]


def _resample_raster(
    input_path: Path,
    output_path: Path,
    target_res_deg: float,
) -> Path:
    """Reproject / resample a raster to EPSG:4326 at the given pixel size.

    Parameters
    ----------
    input_path : Path
        Source GeoTIFF (any CRS).
    output_path : Path
        Destination GeoTIFF.
    target_res_deg : float
        Target pixel size in degrees.

    Returns
    -------
    Path
        The path to the output file.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(input_path) as src:
        dst_crs = "EPSG:4326"

        transform, width, height = calculate_default_transform(
            src.crs,
            dst_crs,
            src.width,
            src.height,
            *src.bounds,
            resolution=target_res_deg,
        )

        profile = src.profile.copy()
        profile.update(
            crs=dst_crs,
            transform=transform,
            width=width,
            height=height,
            dtype="float32",
            compress="deflate",
            nodata=0,
        )

        with rasterio.open(output_path, "w", **profile) as dst:
            for band_idx in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, band_idx),
                    destination=rasterio.band(dst, band_idx),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.average,
                    dst_nodata=0,
                )

    return output_path


@click.command()
@click.option(
    "--input",
    "input_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Path to the VIIRS annual composite GeoTIFF.",
)
@click.option(
    "--output-dir",
    default="../data/processed/",
    type=click.Path(file_okay=False, path_type=Path),
    show_default=True,
    help="Directory for output GeoTIFFs.",
)
def main(input_path: Path, output_dir: Path) -> None:
    """Preprocess VIIRS nighttime lights into multi-resolution rasters."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    for res_km in RESOLUTIONS_KM:
        resolution_m = res_km * 1000
        target_res_deg = resolution_m / METERS_PER_DEGREE

        resampled_path = output_dir / f"viirs_nightlights_{res_km}km_raw.tif"
        final_path = output_dir / f"viirs_nightlights_{res_km}km.tif"

        logger.info(
            "Resampling to %d km (%.6f deg) resolution", res_km, target_res_deg
        )
        _resample_raster(input_path, resampled_path, target_res_deg)

        logger.info("Applying log scaling")
        log_scale_raster(resampled_path, final_path)

        # Remove intermediate raw file.
        resampled_path.unlink()

        logger.info("Building overview pyramids for %s", final_path.name)
        create_overview_pyramids(final_path)

        logger.info("Wrote %s", final_path)

    click.echo("Done. Output files:")
    for res_km in RESOLUTIONS_KM:
        click.echo(f"  {output_dir / f'viirs_nightlights_{res_km}km.tif'}")


if __name__ == "__main__":
    main()
