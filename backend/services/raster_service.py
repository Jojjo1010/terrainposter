import math

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from sqlalchemy.orm import Session

from models.db import Dataset
from models.schemas import HeightmapResponse


def get_dataset_path(db: Session, dataset_name: str, resolution: str) -> str:
    """Query PostGIS datasets table for the file path matching name + resolution."""
    # Parse resolution string like "5km" -> 5
    resolution_km = int(resolution.replace("km", ""))

    row = (
        db.query(Dataset)
        .filter(Dataset.name == dataset_name, Dataset.resolution_km == resolution_km)
        .first()
    )
    if row is None:
        raise ValueError(
            f"No dataset found for name={dataset_name}, resolution={resolution}"
        )
    return row.file_path


def _bbox_from_center(
    lat: float, lon: float, radius_km: float
) -> tuple[float, float, float, float]:
    """Calculate bounding box (west, south, east, north) from center + radius."""
    km_per_deg_lat = 111.32
    km_per_deg_lon = 111.32 * math.cos(math.radians(lat))

    dlat = radius_km / km_per_deg_lat
    dlon = radius_km / km_per_deg_lon if km_per_deg_lon > 0 else radius_km

    south = lat - dlat
    north = lat + dlat
    west = lon - dlon
    east = lon + dlon

    return west, south, east, north


def crop_and_scale(
    file_path: str, lat: float, lon: float, radius_km: float
) -> HeightmapResponse:
    """
    Open a raster file, crop to a bounding box around (lat, lon),
    apply log1p scaling, and normalize to 0-1.
    """
    west, south, east, north = _bbox_from_center(lat, lon, radius_km)

    with rasterio.open(file_path) as src:
        window = from_bounds(west, south, east, north, transform=src.transform)
        data = src.read(1, window=window).astype(np.float64)

    # Replace nodata / NaN with 0
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    # Apply log1p scaling
    data = np.log1p(np.clip(data, 0, None))

    # Normalize to 0-1
    min_val = float(np.min(data))
    max_val = float(np.max(data))
    if max_val > min_val:
        normalized = (data - min_val) / (max_val - min_val)
    else:
        normalized = np.zeros_like(data)

    height, width = normalized.shape
    matrix = normalized.tolist()

    return HeightmapResponse(
        matrix=matrix,
        width=width,
        height=height,
        bounds={"south": south, "north": north, "west": west, "east": east},
        min_val=min_val,
        max_val=max_val,
    )
