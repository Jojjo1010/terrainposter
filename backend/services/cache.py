import json

import redis

from config import settings
from models.schemas import HeightmapResponse

_pool: redis.ConnectionPool | None = None


def _get_pool() -> redis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(
            settings.redis_url, decode_responses=False
        )
    return _pool


def get_redis() -> redis.Redis:
    """Get a synchronous Redis connection from the pool."""
    return redis.Redis(connection_pool=_get_pool())


def cache_get(key: str) -> bytes | None:
    """Get a raw value from Redis."""
    r = get_redis()
    return r.get(key)


def cache_set(key: str, value: bytes, ttl: int) -> None:
    """Set a value in Redis with a TTL in seconds."""
    r = get_redis()
    r.set(key, value, ex=ttl)


def cache_heightmap_get(key: str) -> HeightmapResponse | None:
    """Deserialize a cached HeightmapResponse."""
    data = cache_get(key)
    if data is None:
        return None
    return HeightmapResponse.model_validate_json(data)


def cache_heightmap_set(key: str, response: HeightmapResponse, ttl: int) -> None:
    """Serialize and cache a HeightmapResponse."""
    cache_set(key, response.model_dump_json().encode(), ttl)
