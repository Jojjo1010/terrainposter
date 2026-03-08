import json
import os

import httpx
import numpy as np

from config import settings
from models.db import SessionLocal
from models.schemas import PALETTES, RESOLUTION_PX
from services.raster_service import crop_and_scale, get_dataset_path


def render_poster(config: dict) -> str:
    """
    RQ worker job function.

    1. Generate heightmap from raster data
    2. POST matrix + config to Rayshader service
    3. Save rendered PNG and return file path
    """
    job_id = config["job_id"]

    # Get heightmap
    db = SessionLocal()
    try:
        file_path = get_dataset_path(
            db, config["dataset"], config.get("resolution_data", "5km")
        )
    finally:
        db.close()

    hm = crop_and_scale(file_path, config["lat"], config["lon"], config["radius_km"])

    # Pack matrix as binary (float64)
    matrix_array = np.array(hm.matrix, dtype=np.float64)
    matrix_bytes = matrix_array.tobytes()

    # Resolve output resolution
    render_res = config.get("resolution", "2k")
    px = RESOLUTION_PX.get(render_res, 2048)

    # Build multipart form data for Rayshader service
    # Resolve palette name to hex color array
    palette_key = config.get("palette", "neon_density")
    palette_colors = PALETTES.get(palette_key, PALETTES["neon_density"])

    # Flatten camera config to top-level fields (R expects theta/phi/zoom directly)
    camera = config.get("camera", {"theta": 45.0, "phi": 45.0, "zoom": 0.7})

    render_config = {
        "palette": palette_colors,
        "exaggeration": config.get("exaggeration", 10.0),
        "theta": camera.get("theta", 45.0),
        "phi": camera.get("phi", 45.0),
        "zoom": camera.get("zoom", 0.7),
        "sun_angle": config.get("sun_angle", 315.0),
        "width": px,
        "height": px,
        "background_color": config.get("background_color", "#0B0B0B"),
        "title": config.get("title", ""),
        "font": config.get("font", "sans"),
    }

    files = {
        "matrix_data": ("matrix.bin", matrix_bytes, "application/octet-stream"),
    }
    form_data = {
        "rows": str(hm.height),
        "cols": str(hm.width),
        "config": json.dumps(render_config),
    }

    response = httpx.post(
        f"{settings.rayshader_url}/render",
        files=files,
        data=form_data,
        timeout=settings.render_timeout_seconds,
    )
    response.raise_for_status()

    # Save rendered PNG
    renders_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "renders")
    os.makedirs(renders_dir, exist_ok=True)
    output_path = os.path.join(renders_dir, f"{job_id}.png")

    with open(output_path, "wb") as f:
        f.write(response.content)

    return output_path
