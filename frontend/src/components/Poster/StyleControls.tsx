import { usePosterStore } from "@/stores/posterStore";
import { PALETTES } from "@/types";
import type { Palette } from "@/types";

const PALETTE_LABELS: Record<Palette, string> = {
  neon_density: "Neon Density",
  dark_atlas: "Dark Atlas",
  sunset_heatmap: "Sunset Heatmap",
};

const FONTS = [
  { value: "sans", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
];

export default function StyleControls() {
  const palette = usePosterStore((s) => s.palette);
  const exaggeration = usePosterStore((s) => s.exaggeration);
  const camera = usePosterStore((s) => s.camera);
  const sunAngle = usePosterStore((s) => s.sunAngle);
  const title = usePosterStore((s) => s.title);
  const font = usePosterStore((s) => s.font);
  const backgroundColor = usePosterStore((s) => s.backgroundColor);
  const setPalette = usePosterStore((s) => s.setPalette);
  const setExaggeration = usePosterStore((s) => s.setExaggeration);
  const setCamera = usePosterStore((s) => s.setCamera);
  const setSunAngle = usePosterStore((s) => s.setSunAngle);
  const setTitle = usePosterStore((s) => s.setTitle);
  const setFont = usePosterStore((s) => s.setFont);
  const setBackgroundColor = usePosterStore((s) => s.setBackgroundColor);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
        Style
      </h2>

      {/* Palette */}
      <div>
        <label className="mb-2 block text-xs text-white/50">Palette</label>
        <div className="flex flex-col gap-2">
          {(Object.keys(PALETTES) as Palette[]).map((p) => (
            <button
              key={p}
              onClick={() => setPalette(p)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                palette === p
                  ? "bg-white/10 ring-1 ring-purple-500"
                  : "hover:bg-white/5"
              }`}
            >
              <div
                className="h-4 w-16 rounded"
                style={{
                  background: `linear-gradient(to right, ${PALETTES[p].join(", ")})`,
                }}
              />
              <span className="text-white/70">{PALETTE_LABELS[p]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Exaggeration */}
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Exaggeration: {exaggeration}
        </label>
        <input
          type="range"
          min={1}
          max={50}
          value={exaggeration}
          onChange={(e) => setExaggeration(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Camera controls */}
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Camera Theta: {camera.theta}deg
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          value={camera.theta}
          onChange={(e) => setCamera({ theta: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">
          Camera Phi: {camera.phi}deg
        </label>
        <input
          type="range"
          min={0}
          max={90}
          value={camera.phi}
          onChange={(e) => setCamera({ phi: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">
          Zoom: {camera.zoom.toFixed(1)}
        </label>
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.1}
          value={camera.zoom}
          onChange={(e) => setCamera({ zoom: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Sun angle */}
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Sun Angle: {sunAngle}deg
        </label>
        <input
          type="range"
          min={0}
          max={360}
          value={sunAngle}
          onChange={(e) => setSunAngle(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs text-white/50">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Poster title"
          className="w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-purple-500/50"
        />
      </div>

      {/* Font */}
      <div>
        <label className="mb-1 block text-xs text-white/50">Font</label>
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} className="bg-gray-900">
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Background color */}
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Background Color
        </label>
        <input
          type="text"
          value={backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
          placeholder="#0B0B0B"
          className="w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-purple-500/50"
        />
      </div>
    </div>
  );
}
