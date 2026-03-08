import { usePosterStore } from "@/stores/posterStore";
import { PALETTES } from "@/types";
import { useGlobeData } from "@/hooks/useGlobeData";

export default function GlobeControls() {
  const palette = usePosterStore((s) => s.palette);
  const { data: heightmap, isLoading } = useGlobeData();
  const colors = PALETTES[palette];

  const pointCount = heightmap
    ? heightmap.matrix.flat().filter((v) => v > 0).length
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Palette legend */}
      <div className="rounded-lg bg-white/5 px-4 py-3 backdrop-blur-sm">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">
          Color Palette
        </label>
        <div
          className="h-3 w-full rounded-full"
          style={{
            background: `linear-gradient(to right, ${colors.join(", ")})`,
          }}
        />
      </div>

      {/* Info */}
      <div className="rounded-lg bg-white/5 px-4 py-2.5 text-xs text-white/40 backdrop-blur-sm">
        {isLoading
          ? "Loading data..."
          : `${pointCount.toLocaleString()} data points`}
      </div>
    </div>
  );
}
