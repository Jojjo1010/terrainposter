"""Shared utilities for the TerrainPoster data preprocessing pipeline.

Provides functions for rasterizing vector data, building overview pyramids,
log-scaling rasters, cropping to bounding boxes, and array normalization.
"""

from __future__ import annotations

from pathlib import Path
from typing import Union

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.windows import from_bounds as window_from_bounds

import geopandas as gpd

# Approximate meters per degree of latitude at the equator.
METERS_PER_DEGREE = 111_320.0


def hex_to_raster(
    gdf: gpd.GeoDataFrame,
    resolution_m: float,
    output_path: Union[str, Path],
    value_column: str = "population",
) -> Path:
    """Rasterize a GeoDataFrame of polygons (e.g. H3 hexagons) to a GeoTIFF.

    Parameters
    ----------
    gdf : gpd.GeoDataFrame
        Input polygons with a geometry column and a numeric value column.
    resolution_m : float
        Desired raster cell size in meters. Converted to approximate degrees.
    output_path : str or Path
        Destination path for the output GeoTIFF.
    value_column : str
        Column in *gdf* that holds the values to burn into the raster.

    Returns
    -------
    Path
        The path to the written GeoTIFF.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert resolution from meters to approximate degrees.
    pixel_size_deg = resolution_m / METERS_PER_DEGREE

    # Compute raster extent from the GeoDataFrame bounds.
    total_bounds = gdf.total_bounds  # (minx, miny, maxx, maxy)
    west, south, east, north = total_bounds

    # Compute raster dimensions.
    width = max(1, int(np.ceil((east - west) / pixel_size_deg)))
    height = max(1, int(np.ceil((north - south) / pixel_size_deg)))

    transform = from_bounds(west, south, east, north, width, height)

    # Build (geometry, value) pairs for rasterization.
    shapes = (
        (geom, val)
        for geom, val in zip(gdf.geometry, gdf[value_column])
        if geom is not None and np.isfinite(val)
    )

    burned = rasterize(
        shapes,
        out_shape=(height, width),
        transform=transform,
        fill=0,
        dtype="float32",
        merge_alg=rasterio.enums.MergeAlg.add,
    )

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
        dst.write(burned, 1)

    return output_path


def create_overview_pyramids(tif_path: Union[str, Path]) -> None:
    """Build internal overview pyramids for a GeoTIFF.

    Factors: 2, 4, 8, 16 using average resampling.

    Parameters
    ----------
    tif_path : str or Path
        Path to an existing GeoTIFF file (modified in-place).
    """
    factors = [2, 4, 8, 16]

    with rasterio.open(tif_path, "r+") as dst:
        dst.build_overviews(factors, Resampling.average)
        dst.update_tags(ns="rio_overview", resampling="average")


def log_scale_raster(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
) -> Path:
    """Apply log1p scaling to a raster and write to a new GeoTIFF.

    Uses ``np.log1p`` (i.e. ``log(value + 1)``) so that zero values remain
    zero. Preserves all georeferencing metadata from the source file.

    Parameters
    ----------
    input_path : str or Path
        Source GeoTIFF.
    output_path : str or Path
        Destination GeoTIFF.

    Returns
    -------
    Path
        The path to the output file.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(input_path) as src:
        profile = src.profile.copy()
        profile.update(dtype="float32", compress="deflate")
        data = src.read(1).astype("float32")

    scaled = np.log1p(data)

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(scaled, 1)

    return output_path


def crop_raster_to_bounds(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    bounds: dict,
) -> Path:
    """Crop a raster to a geographic bounding box using windowed reading.

    Parameters
    ----------
    input_path : str or Path
        Source GeoTIFF.
    output_path : str or Path
        Destination GeoTIFF.
    bounds : dict
        Bounding box with keys ``south``, ``north``, ``west``, ``east``
        in EPSG:4326 degrees.

    Returns
    -------
    Path
        The path to the cropped output file.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with rasterio.open(input_path) as src:
        window = window_from_bounds(
            bounds["west"],
            bounds["south"],
            bounds["east"],
            bounds["north"],
            transform=src.transform,
        )
        # Align to integer pixel offsets.
        window = window.round_offsets().round_lengths()

        transform = src.window_transform(window)
        data = src.read(1, window=window)

        profile = src.profile.copy()
        profile.update(
            width=int(window.width),
            height=int(window.height),
            transform=transform,
        )

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(data, 1)

    return output_path


def normalize_array(arr: np.ndarray) -> np.ndarray:
    """Normalize a numpy array to the 0-1 range.

    Zero values (treated as nodata) are preserved as zero. Only non-zero
    values participate in the min-max normalization.

    Parameters
    ----------
    arr : np.ndarray
        Input array.

    Returns
    -------
    np.ndarray
        Normalized copy of *arr* with the same shape and dtype float32.
    """
    result = np.zeros_like(arr, dtype="float32")
    mask = arr != 0

    if not mask.any():
        return result

    valid = arr[mask].astype("float32")
    vmin, vmax = valid.min(), valid.max()

    if vmax == vmin:
        result[mask] = 1.0
    else:
        result[mask] = (valid - vmin) / (vmax - vmin)

    return result
