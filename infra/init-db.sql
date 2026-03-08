-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Datasets registry table
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    resolution_km INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    bbox GEOMETRY(Polygon, 4326),
    min_value FLOAT,
    max_value FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, resolution_km)
);

-- Spatial index on bounding boxes
CREATE INDEX IF NOT EXISTS idx_datasets_bbox ON datasets USING GIST(bbox);

-- Render cache metadata table
CREATE TABLE IF NOT EXISTS render_cache (
    id SERIAL PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    dataset TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    radius_km FLOAT NOT NULL,
    config JSONB NOT NULL,
    image_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_render_cache_key ON render_cache(cache_key);

-- Geocode cache table
CREATE TABLE IF NOT EXISTS geocode_cache (
    id SERIAL PRIMARY KEY,
    query TEXT UNIQUE NOT NULL,
    results JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geocode_query ON geocode_cache(query);
