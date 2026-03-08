import type {
  GeocodeResponse,
  HeightmapRequest,
  HeightmapResponse,
  RenderRequest,
  RenderJobResponse,
  RenderStatusResponse,
} from "@/types";

const BASE_URL = "/api";

export async function geocode(query: string): Promise<GeocodeResponse[]> {
  const res = await fetch(
    `${BASE_URL}/geocode?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Geocode failed: ${res.statusText}`);
  return res.json();
}

export async function getHeightmap(
  req: HeightmapRequest,
): Promise<HeightmapResponse> {
  const res = await fetch(`${BASE_URL}/heightmap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Heightmap failed: ${res.statusText}`);
  return res.json();
}

export async function startRender(
  req: RenderRequest,
): Promise<RenderJobResponse> {
  const res = await fetch(`${BASE_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Render failed: ${res.statusText}`);
  return res.json();
}

export async function getRenderStatus(
  jobId: string,
): Promise<RenderStatusResponse> {
  const res = await fetch(`${BASE_URL}/render/${jobId}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.statusText}`);
  return res.json();
}

export function getRenderResult(jobId: string): string {
  return `${BASE_URL}/render/${jobId}/result`;
}

export function connectRenderProgress(
  jobId: string,
  onMessage: (status: RenderStatusResponse) => void,
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const ws = new WebSocket(`${protocol}//${host}/ws/render/${jobId}/progress`);

  ws.onmessage = (event) => {
    const data: RenderStatusResponse = JSON.parse(event.data);
    onMessage(data);
  };

  return ws;
}
