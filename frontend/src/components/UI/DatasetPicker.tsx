import { usePosterStore } from "@/stores/posterStore";
import type { Dataset } from "@/types";

const DATASETS: { value: Dataset; label: string }[] = [
  { value: "population", label: "Population" },
  { value: "nightlights", label: "Night Lights" },
  { value: "airquality", label: "Air Quality" },
  { value: "lightpollution", label: "Light Pollution" },
];

export default function DatasetPicker() {
  const dataset = usePosterStore((s) => s.dataset);
  const setDataset = usePosterStore((s) => s.setDataset);

  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md">
      {DATASETS.map((d) => (
        <button
          key={d.value}
          onClick={() => setDataset(d.value)}
          className={`
            rounded-lg px-3 py-1 text-[11px] font-medium transition-all duration-200
            ${
              dataset === d.value
                ? "bg-white/15 text-white shadow-sm"
                : "bg-transparent text-white/40 hover:text-white/60 hover:bg-white/5"
            }
          `}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
