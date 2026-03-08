# TerrainPoster

Generate beautiful 3D terrain poster renders from geospatial datasets -- population density, night lights, air quality, and more.

## Architecture

```
                          +-------------------+
                          |     Frontend      |
                          |  (Vite + React)   |
                          |    :3000          |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |     Backend       |
                          |  (FastAPI)        |
                          |    :8000          |
                          +--+-----+------+---+
                             |     |      |
                    +--------+  +--+--+  ++----------+
                    |           |     |               |
              +-----v---+ +----v-+ +-v--------+ +----v------+
              | PostGIS  | |Redis| | Rayshader| |   Data    |
              |  :5432   | |:6379| | Service  | | (volumes) |
              +----------+ +-----+ |  :8787   | +-----------+
                                   +----------+
```

**Services:**

- **Frontend** -- Vite/React app for configuring and previewing poster renders.
- **Backend** -- FastAPI server handling geocoding, dataset queries, and render orchestration.
- **Worker** -- RQ worker that processes render jobs from the Redis queue.
- **Rayshader Service** -- R/Plumber microservice wrapping rayshader for 3D rendering.
- **PostGIS** -- Spatial database storing dataset metadata and render cache.
- **Redis** -- Job queue and ephemeral caching layer.

## Prerequisites

- **Docker Desktop** (v4.x+ recommended)
- **~30 GB free disk space** for downloaded datasets
- **Git** for cloning the repository

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url> terrainposter
cd terrainposter
```

### 2. Download datasets

Download and place raw dataset files into `data/raw/`:

- **Kontur Population Density**
  Download the global GeoPackage from Humanitarian Data Exchange:
  https://data.humdata.org/dataset/kontur-population-dataset

- **VIIRS Night Lights**
  Download annual composite GeoTIFFs from the NOAA Earth Observation Group (EOG) site:
  https://eogdata.mines.edu/products/vnl/

- **OpenAQ Air Quality**
  Fetch station-level measurements via the OpenAQ API or bulk downloads:
  https://openaq.org

Place downloaded files in the appropriate subdirectories:

```
data/raw/
  kontur/         # .gpkg files
  nightlights/    # .tif files
  openaq/         # .csv or .json files
```

### 3. Run the preprocessing pipeline

```bash
cd pipeline
python run.py --all
```

This converts raw datasets into optimized GeoTIFFs in `data/processed/`.

### 4. Start all services

```bash
cd infra
docker compose up --build
```

Once healthy, open http://localhost:3000 in your browser.

## API Documentation

The backend exposes an interactive API reference at:

```
http://localhost:8000/docs
```

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/datasets` | List available datasets |
| POST | `/geocode` | Geocode a place name |
| POST | `/render` | Submit a render job |
| GET | `/render/{id}/status` | Poll render progress |
| GET | `/render/{id}/result` | Download finished render |
| WS | `/ws/render/{id}` | Real-time render progress |

## Configuration

Create an `.env` file in `infra/` to override defaults:

```env
# Database
POSTGRES_DB=terrainposter
POSTGRES_USER=postgres
POSTGRES_PASSWORD=terrain

# Backend
DATA_DIR=/data/processed
REDIS_URL=redis://redis:6379
RAYSHADER_URL=http://rayshader:8787

# Optional: geocoding provider API key
GEOCODE_API_KEY=

# Optional: limit worker concurrency
RQ_WORKER_COUNT=2
```

## Development Setup

To run services individually outside Docker:

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Rayshader service:**
```bash
cd rayshader-service
Rscript plumber.R
```

**Worker:**
```bash
cd backend
python -m rq worker --url redis://localhost:6379 render
```

## Folder Structure

```
terrainposter/
  backend/            # FastAPI application and RQ worker
  frontend/           # Vite + React UI
  rayshader-service/  # R/Plumber 3D rendering microservice
  pipeline/           # Data preprocessing scripts
  data/
    raw/              # Downloaded source datasets
    processed/        # Optimized GeoTIFFs ready for rendering
  infra/
    docker-compose.yml
    init-db.sql       # PostGIS schema initialization
    nginx.conf        # Reverse proxy config (production)
```
