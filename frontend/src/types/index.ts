// Shared API contracts — matches backend/models/schemas.py

export interface GeocodeResponse {
  lat: number;
  lon: number;
  display_name: string;
  bbox: [number, number, number, number]; // [south, north, west, east]
}

export interface HeightmapRequest {
  lat: number;
  lon: number;
  radius_km: number;
  dataset: Dataset;
  resolution: Resolution;
}

export interface HeightmapResponse {
  matrix: number[][];
  width: number;
  height: number;
  bounds: { south: number; north: number; west: number; east: number };
  min_val: number;
  max_val: number;
}

export interface CameraConfig {
  theta: number;
  phi: number;
  zoom: number;
}

export interface RenderRequest {
  lat: number;
  lon: number;
  radius_km: number;
  dataset: Dataset;
  palette: Palette;
  exaggeration: number;
  camera: CameraConfig;
  sun_angle: number;
  title: string;
  font: string;
  resolution: ExportResolution;
  background_color: string;
}

export interface RenderJobResponse {
  job_id: string;
}

export interface RenderStatusResponse {
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  image_url: string | null;
  error: string | null;
}

export type Dataset = "population" | "nightlights" | "airquality" | "lightpollution";
export type Resolution = "1km" | "5km" | "20km";
export type ExportResolution = "2k" | "4k" | "8k";
export type Palette = "neon_density" | "dark_atlas" | "sunset_heatmap";

export const PALETTES: Record<Palette, string[]> = {
  neon_density: ["#0D0887", "#6A00A8", "#B12A90", "#E16462", "#FCA636", "#F0F921"],
  dark_atlas: ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#F5F5F5"],
  sunset_heatmap: ["#2C003E", "#7B1FA2", "#E91E63", "#FF7043", "#FFD54F"],
};

export const RESOLUTION_PX: Record<ExportResolution, number> = {
  "2k": 2048,
  "4k": 4096,
  "8k": 8192,
};
