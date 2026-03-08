import os
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from routers import geocode, heightmap, render


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create Redis connection pool
    app.state.redis_pool = aioredis.ConnectionPool.from_url(
        settings.redis_url, decode_responses=False
    )
    app.state.redis = aioredis.Redis(connection_pool=app.state.redis_pool)

    yield

    # Shutdown: close Redis pool
    await app.state.redis_pool.disconnect()


app = FastAPI(title="TerrainPoster API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(geocode.router, prefix="/geocode", tags=["geocode"])
app.include_router(heightmap.router, prefix="/heightmap", tags=["heightmap"])
app.include_router(render.router, prefix="/render", tags=["render"])

# Static files for rendered images
renders_dir = os.path.join(os.path.dirname(__file__), "renders")
os.makedirs(renders_dir, exist_ok=True)
app.mount("/renders", StaticFiles(directory=renders_dir), name="renders")
