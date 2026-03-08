import { useState } from "react";
import Globe from "@/components/Globe/Globe";
import GlobeControls from "@/components/Globe/GlobeControls";
import CitySearch from "@/components/Search/CitySearch";
import DatasetPicker from "@/components/UI/DatasetPicker";
import PosterPreview from "@/components/Poster/PosterPreview";
import StyleControls from "@/components/Poster/StyleControls";
import ExportButton from "@/components/Poster/ExportButton";
import { usePosterStore } from "@/stores/posterStore";

export default function App() {
  const [mode, setMode] = useState<"globe" | "poster">("globe");
  const city = usePosterStore((s) => s.city);

  const handleGeneratePoster = () => {
    if (city) {
      setMode("poster");
    }
  };

  const handleBackToGlobe = () => {
    setMode("globe");
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B0B0B]">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 px-6 py-3">
        <h1
          className="cursor-pointer text-lg font-bold tracking-wide text-white"
          onClick={handleBackToGlobe}
        >
          TerrainPoster
        </h1>
        <DatasetPicker />
        <CitySearch />
        <div className="ml-auto">
          {mode === "globe" && (
            <button
              onClick={handleGeneratePoster}
              disabled={!city}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate Poster
            </button>
          )}
          {mode === "poster" && (
            <button
              onClick={handleBackToGlobe}
              className="rounded-lg border border-white/20 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Back to Globe
            </button>
          )}
        </div>
      </header>

      {/* Main area */}
      <main className="relative flex min-h-0 flex-1">
        {mode === "globe" ? (
          <div className="relative h-full w-full">
            <Globe />
            <GlobeControls />
          </div>
        ) : (
          <div className="flex h-full w-full">
            {/* Left: style controls */}
            <aside className="h-full w-80 shrink-0 overflow-y-auto border-r border-white/10 p-4">
              <StyleControls />
              <div className="mt-6">
                <ExportButton />
              </div>
            </aside>
            {/* Right: poster preview */}
            <div className="flex flex-1 items-center justify-center p-8">
              <PosterPreview />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
