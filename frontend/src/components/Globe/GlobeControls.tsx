import { usePosterStore } from "@/stores/posterStore";
import { PALETTES } from "@/types";
import type { Dataset } from "@/types";
import { useGlobeData } from "@/hooks/useGlobeData";

const DATASET_LABELS: Record<Dataset, string> = {
  population: "Population Density",
  nightlights: "Night Lights",
  airquality: "Air Pollution",
  lightpollution: "Light Pollution",
};

export default function GlobeControls() {
  const dataset = usePosterStore((s) => s.dataset);
  const palette = usePosterStore((s) => s.palette);
  const setDataset = usePosterStore((s) => s.setDataset);
  const { data: heightmap, isLoading } = useGlobeData();
  const colors = PALETTES[palette];

  const pointCount = heightmap
    ? heightmap.matrix.flat().filter((v) => v > 0).length
    : 0;

  return (
    <div className="pointer-events-auto absolute bottom-6 left-6 flex flex-col gap-3">
      {/* Dataset selector */}
      <div className="rounded-lg bg-black/60 px-4 py-3 backdrop-blur-sm">
        <label className="mb-1 block text-xs text-white/50">Dataset</label>
        <select
          value={dataset}
          onChange={(e) => setDataset(e.target.value as Dataset)}
          className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white outline-none"
        >
          {Object.entries(DATASET_LABELS).map(([key, label]) => (
            <option key={key} value={key} className="bg-gray-900">
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Palette legend */}
      <div className="rounded-lg bg-black/60 px-4 py-3 backdrop-blur-sm">
        <label className="mb-1 block text-xs text-white/50">
          Color Palette
        </label>
        <div
          className="h-3 w-40 rounded"
          style={{
            background: `linear-gradient(to right, ${colors.join(", ")})`,
          }}
        />
      </div>

      {/* Info */}
      <div className="rounded-lg bg-black/60 px-4 py-2 text-xs text-white/40 backdrop-blur-sm">
        {isLoading
          ? "Loading data..."
          : `${pointCount.toLocaleString()} data points`}
      </div>
    </div>
  );
}
