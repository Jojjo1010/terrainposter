import { usePosterStore } from "@/stores/posterStore";
import { startRender, getRenderResult } from "@/api/client";
import { useRenderJob } from "@/hooks/useRenderJob";
import type { ExportResolution } from "@/types";

const RESOLUTIONS: { value: ExportResolution; label: string }[] = [
  { value: "2k", label: "2K" },
  { value: "4k", label: "4K" },
  { value: "8k", label: "8K" },
];

export default function ExportButton() {
  const city = usePosterStore((s) => s.city);
  const dataset = usePosterStore((s) => s.dataset);
  const radiusKm = usePosterStore((s) => s.radiusKm);
  const palette = usePosterStore((s) => s.palette);
  const exaggeration = usePosterStore((s) => s.exaggeration);
  const camera = usePosterStore((s) => s.camera);
  const sunAngle = usePosterStore((s) => s.sunAngle);
  const title = usePosterStore((s) => s.title);
  const font = usePosterStore((s) => s.font);
  const resolution = usePosterStore((s) => s.resolution);
  const backgroundColor = usePosterStore((s) => s.backgroundColor);
  const renderStatus = usePosterStore((s) => s.renderStatus);
  const renderProgress = usePosterStore((s) => s.renderProgress);
  const renderJobId = usePosterStore((s) => s.renderJobId);
  const setResolution = usePosterStore((s) => s.setResolution);
  const setRenderJob = usePosterStore((s) => s.setRenderJob);

  // Connect WebSocket for active job
  useRenderJob(renderJobId);

  const handleGenerate = async () => {
    if (!city) return;
    try {
      const resp = await startRender({
        lat: city.lat,
        lon: city.lon,
        radius_km: radiusKm,
        dataset,
        palette,
        exaggeration,
        camera,
        sun_angle: sunAngle,
        title,
        font,
        resolution,
        background_color: backgroundColor,
      });
      setRenderJob(resp.job_id);
    } catch (err) {
      console.error("Failed to start render:", err);
    }
  };

  const handleDownload = () => {
    if (!renderJobId) return;
    const url = getRenderResult(renderJobId);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "poster"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isRendering = renderStatus === "queued" || renderStatus === "rendering";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
        Export
      </h2>

      {/* Resolution selector */}
      <div className="flex gap-2">
        {RESOLUTIONS.map((r) => (
          <label
            key={r.value}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              resolution === r.value
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              name="resolution"
              value={r.value}
              checked={resolution === r.value}
              onChange={() => setResolution(r.value)}
              className="hidden"
            />
            {r.label}
          </label>
        ))}
      </div>

      {/* Generate button */}
      {renderStatus !== "done" && (
        <button
          onClick={handleGenerate}
          disabled={!city || isRendering}
          className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRendering
            ? `Rendering... ${renderProgress}%`
            : "Generate Poster"}
        </button>
      )}

      {/* Download button */}
      {renderStatus === "done" && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDownload}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            Download
          </button>
          <button
            onClick={handleGenerate}
            disabled={!city}
            className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5"
          >
            Re-generate
          </button>
        </div>
      )}
    </div>
  );
}
