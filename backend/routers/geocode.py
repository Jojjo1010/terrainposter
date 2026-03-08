import asyncio
import json

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Query, Request

from config import settings
from models.schemas import GeocodeResponse

router = APIRouter()

# Module-level lock for Nominatim rate limiting (1 req/sec)
_nominatim_lock = asyncio.Lock()
_last_request_time: float = 0.0


@router.get("/", response_model=list[GeocodeResponse])
async def geocode(request: Request, q: str = Query(..., min_length=1)):
    """Search for a location by name, with Redis caching."""
    global _last_request_time

    r: aioredis.Redis = request.app.state.redis
    cache_key = f"geocode:{q}"

    # Check cache
    cached = await r.get(cache_key)
    if cached is not None:
        data = json.loads(cached)
        return [GeocodeResponse(**item) for item in data]

    # Rate limit: ensure at least 1 second between Nominatim requests
    async with _nominatim_lock:
        now = asyncio.get_event_loop().time()
        elapsed = now - _last_request_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.nominatim_url}/search",
                params={"q": q, "format": "json", "limit": 5},
                headers={"User-Agent": settings.nominatim_user_agent},
            )
            resp.raise_for_status()

        _last_request_time = asyncio.get_event_loop().time()

    raw_results = resp.json()

    results = []
    for item in raw_results:
        bbox_raw = item.get("boundingbox", [])
        results.append(
            GeocodeResponse(
                lat=float(item["lat"]),
                lon=float(item["lon"]),
                display_name=item["display_name"],
                bbox=[float(x) for x in bbox_raw],
            )
        )

    # Cache for 7 days
    ttl = 7 * 24 * 3600
    serialized = json.dumps([r.model_dump() for r in results])
    await request.app.state.redis.set(cache_key, serialized.encode(), ex=ttl)

    return results
