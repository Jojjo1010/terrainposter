import json

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from config import settings
from models.db import get_db
from models.schemas import HeightmapRequest, HeightmapResponse
from services.raster_service import crop_and_scale, get_dataset_path

router = APIRouter()


@router.post("/", response_model=HeightmapResponse)
async def create_heightmap(
    body: HeightmapRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate a heightmap from raster data, with Redis caching."""
    r: aioredis.Redis = request.app.state.redis
    cache_key = (
        f"hm:{body.dataset}:{body.lat}:{body.lon}:"
        f"{body.radius_km}:{body.resolution}"
    )

    # Check cache
    cached = await r.get(cache_key)
    if cached is not None:
        return HeightmapResponse.model_validate_json(cached)

    # Query PostGIS for the dataset file path
    file_path = get_dataset_path(db, body.dataset, body.resolution)

    # Crop and scale the raster
    result = crop_and_scale(file_path, body.lat, body.lon, body.radius_km)

    # Cache result
    await r.set(
        cache_key,
        result.model_dump_json().encode(),
        ex=settings.cache_ttl_heightmap,
    )

    return result
