"""Shared API contracts — all services code against these types."""

from pydantic import BaseModel, Field


# --- Geocode ---

class GeocodeResponse(BaseModel):
    lat: float
    lon: float
    display_name: str
    bbox: list[float] = Field(description="[south, north, west, east]")


# --- Heightmap ---

class HeightmapRequest(BaseModel):
    lat: float
    lon: float
    radius_km: float = 100.0
    dataset: str = "population"
    resolution: str = "5km"


class HeightmapResponse(BaseModel):
    matrix: list[list[float]]
    width: int
    height: int
    bounds: dict = Field(description="{'south','north','west','east'}")
    min_val: float
    max_val: float


# --- Render ---

class CameraConfig(BaseModel):
    theta: float = 45.0
    phi: float = 45.0
    zoom: float = 0.7


class RenderRequest(BaseModel):
    lat: float
    lon: float
    radius_km: float = 100.0
    dataset: str = "population"
    palette: str = "neon_density"
    exaggeration: float = 10.0
    camera: CameraConfig = CameraConfig()
    sun_angle: float = 315.0
    title: str = ""
    font: str = "sans"
    resolution: str = "2k"
    background_color: str = "#0B0B0B"


class RenderJobResponse(BaseModel):
    job_id: str


class RenderStatusResponse(BaseModel):
    status: str  # queued | rendering | done | error
    progress: float = 0.0
    image_url: str | None = None
    error: str | None = None


# --- Datasets ---

DATASETS = ["population", "nightlights", "airquality", "lightpollution"]

RESOLUTIONS = ["1km", "5km", "20km"]

PALETTES = {
    "neon_density": ["#0D0887", "#6A00A8", "#B12A90", "#E16462", "#FCA636", "#F0F921"],
    "dark_atlas": ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#F5F5F5"],
    "sunset_heatmap": ["#2C003E", "#7B1FA2", "#E91E63", "#FF7043", "#FFD54F"],
}

RESOLUTION_PX = {
    "2k": 2048,
    "4k": 4096,
    "8k": 8192,
}
