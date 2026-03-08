import { create } from "zustand";
import type {
  Dataset,
  Palette,
  CameraConfig,
  ExportResolution,
  HeightmapResponse,
  RenderStatusResponse,
} from "@/types";
import { getRenderResult } from "@/api/client";

export interface PosterState {
  city: { name: string; lat: number; lon: number } | null;
  dataset: Dataset;
  radiusKm: number;
  heightmap: HeightmapResponse | null;
  palette: Palette;
  exaggeration: number;
  camera: CameraConfig;
  sunAngle: number;
  title: string;
  font: string;
  resolution: ExportResolution;
  backgroundColor: string;
  renderJobId: string | null;
  renderStatus: "idle" | "queued" | "rendering" | "done" | "error";
  renderProgress: number;
  renderImageUrl: string | null;
  // Actions
  setCity: (city: PosterState["city"]) => void;
  setDataset: (d: Dataset) => void;
  setPalette: (p: Palette) => void;
  setExaggeration: (e: number) => void;
  setCamera: (c: Partial<CameraConfig>) => void;
  setSunAngle: (a: number) => void;
  setTitle: (t: string) => void;
  setFont: (f: string) => void;
  setBackgroundColor: (c: string) => void;
  setRadiusKm: (r: number) => void;
  setResolution: (r: ExportResolution) => void;
  setHeightmap: (h: HeightmapResponse) => void;
  setRenderJob: (jobId: string) => void;
  updateRenderStatus: (status: RenderStatusResponse) => void;
  reset: () => void;
}

const initialState = {
  city: null,
  dataset: "population" as Dataset,
  radiusKm: 50,
  heightmap: null,
  palette: "neon_density" as Palette,
  exaggeration: 10,
  camera: { theta: 45, phi: 30, zoom: 1 },
  sunAngle: 135,
  title: "",
  font: "sans",
  resolution: "4k" as ExportResolution,
  backgroundColor: "#0B0B0B",
  renderJobId: null,
  renderStatus: "idle" as const,
  renderProgress: 0,
  renderImageUrl: null,
};

export const usePosterStore = create<PosterState>((set) => ({
  ...initialState,

  setCity: (city) =>
    set({ city, title: city?.name ?? "", renderStatus: "idle" }),

  setDataset: (dataset) => set({ dataset }),

  setPalette: (palette) => set({ palette }),

  setExaggeration: (exaggeration) => set({ exaggeration }),

  setCamera: (c) =>
    set((state) => ({ camera: { ...state.camera, ...c } })),

  setSunAngle: (sunAngle) => set({ sunAngle }),

  setTitle: (title) => set({ title }),

  setFont: (font) => set({ font }),

  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),

  setRadiusKm: (radiusKm) => set({ radiusKm }),

  setResolution: (resolution) => set({ resolution }),

  setHeightmap: (heightmap) => set({ heightmap }),

  setRenderJob: (jobId) =>
    set({
      renderJobId: jobId,
      renderStatus: "queued",
      renderProgress: 0,
      renderImageUrl: null,
    }),

  updateRenderStatus: (status) =>
    set({
      renderStatus: status.status,
      renderProgress: status.progress,
      renderImageUrl:
        status.status === "done" && status.image_url
          ? status.image_url
          : status.status === "done"
            ? getRenderResult(
                usePosterStore.getState().renderJobId ?? "",
              )
            : null,
    }),

  reset: () => set(initialState),
}));
