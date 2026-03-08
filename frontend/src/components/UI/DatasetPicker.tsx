import { usePosterStore } from "@/stores/posterStore";
import type { Dataset } from "@/types";

const DATASETS: { value: Dataset; label: string }[] = [
  { value: "population", label: "Population Density" },
  { value: "nightlights", label: "Night Lights" },
  { value: "airquality", label: "Air Pollution" },
  { value: "lightpollution", label: "Light Pollution" },
];

export default function DatasetPicker() {
  const dataset = usePosterStore((s) => s.dataset);
  const setDataset = usePosterStore((s) => s.setDataset);

  return (
    <select
      value={dataset}
      onChange={(e) => setDataset(e.target.value as Dataset)}
      className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 transition focus:ring-purple-500/50"
    >
      {DATASETS.map((d) => (
        <option key={d.value} value={d.value} className="bg-gray-900">
          {d.label}
        </option>
      ))}
    </select>
  );
}
