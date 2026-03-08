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
    <div className="flex w-[200px] flex-col gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 backdrop-blur-md">
      {/* Palette gradient bar */}
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background: `linear-gradient(to right, ${colors.join(", ")})`,
        }}
      />

      {/* Data info */}
      <p className="text-[10px] text-white/30">
        {isLoading
          ? "Loading\u2026"
          : `${pointCount.toLocaleString()} data points`}
      </p>
    </div>
  );
}
