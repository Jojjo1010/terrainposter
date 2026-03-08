import asyncio
import json
import os
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from redis import Redis
from rq import Queue
from rq.job import Job

from config import settings
from models.schemas import RenderJobResponse, RenderRequest, RenderStatusResponse
from services.render_queue import render_poster

router = APIRouter()

RENDERS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "renders")


def _get_rq_queue() -> Queue:
    """Create an RQ queue backed by a synchronous Redis connection."""
    conn = Redis.from_url(settings.redis_url)
    return Queue(connection=conn)


def _job_to_status(job: Job | None, job_id: str) -> RenderStatusResponse:
    """Convert an RQ job to a RenderStatusResponse."""
    if job is None:
        # Check if a rendered file already exists
        png_path = os.path.join(RENDERS_DIR, f"{job_id}.png")
        if os.path.exists(png_path):
            return RenderStatusResponse(
                status="done",
                progress=1.0,
                image_url=f"/renders/{job_id}.png",
            )
        return RenderStatusResponse(status="error", error="Job not found")

    status_map = {
        "queued": "queued",
        "started": "rendering",
        "finished": "done",
        "failed": "error",
        "deferred": "queued",
        "scheduled": "queued",
        "canceled": "error",
        "stopped": "error",
    }

    rq_status = job.get_status()
    mapped = status_map.get(rq_status, "queued")

    progress = job.meta.get("progress", 0.0) if job.meta else 0.0
    image_url = None
    error = None

    if mapped == "done":
        progress = 1.0
        image_url = f"/renders/{job_id}.png"
    elif mapped == "error":
        error = str(job.exc_info) if job.exc_info else "Job failed"

    return RenderStatusResponse(
        status=mapped,
        progress=progress,
        image_url=image_url,
        error=error,
    )


@router.post("/", response_model=RenderJobResponse)
async def create_render(body: RenderRequest):
    """Enqueue a render job and return the job ID."""
    job_id = str(uuid.uuid4())

    config = body.model_dump()
    config["job_id"] = job_id

    queue = _get_rq_queue()
    queue.enqueue(
        render_poster,
        config,
        job_id=job_id,
        job_timeout=settings.render_timeout_seconds,
    )

    return RenderJobResponse(job_id=job_id)


@router.get("/{job_id}/status", response_model=RenderStatusResponse)
async def get_render_status(job_id: str):
    """Check the status of a render job."""
    queue = _get_rq_queue()
    try:
        job = Job.fetch(job_id, connection=queue.connection)
    except Exception:
        job = None

    return _job_to_status(job, job_id)


@router.get("/{job_id}/result")
async def get_render_result(job_id: str):
    """Download the rendered PNG file."""
    png_path = os.path.join(RENDERS_DIR, f"{job_id}.png")
    if not os.path.exists(png_path):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Render not found")
    return FileResponse(png_path, media_type="image/png", filename=f"{job_id}.png")


@router.websocket("/{job_id}/progress")
async def render_progress(websocket: WebSocket, job_id: str):
    """WebSocket endpoint that streams render progress updates."""
    await websocket.accept()

    queue = _get_rq_queue()

    try:
        while True:
            try:
                job = Job.fetch(job_id, connection=queue.connection)
            except Exception:
                job = None

            status = _job_to_status(job, job_id)
            await websocket.send_json(status.model_dump())

            if status.status in ("done", "error"):
                break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
