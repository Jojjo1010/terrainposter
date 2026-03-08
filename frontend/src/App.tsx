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
    if (city) setMode("poster");
  };

  const handleBackToGlobe = () => {
    setMode("globe");
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0B0B]">
      {/* Globe fills entire viewport */}
      <div className="absolute inset-0">
        <Globe />
      </div>

      {/* Left side panel — overlays on top of the globe */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-80 flex-col">
        <div className="pointer-events-auto flex flex-col gap-4 overflow-y-auto p-5">
          {/* Logo / title */}
          <h1
            className="cursor-pointer text-xl font-bold tracking-widest text-white/90"
            onClick={handleBackToGlobe}
          >
            TERRAINPOSTER
          </h1>

          {/* Search */}
          <CitySearch />

          {/* Dataset picker */}
          <DatasetPicker />

          {/* Globe controls (palette, data info) */}
          {mode === "globe" && <GlobeControls />}

          {/* Poster controls */}
          {mode === "poster" && (
            <>
              <StyleControls />
              <ExportButton />
            </>
          )}

          {/* Mode toggle button */}
          <div className="pt-2">
            {mode === "globe" ? (
              <button
                onClick={handleGeneratePoster}
                disabled={!city}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Generate Poster
              </button>
            ) : (
              <button
                onClick={handleBackToGlobe}
                className="w-full rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Back to Globe
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Poster preview — centered overlay when in poster mode */}
      {mode === "poster" && (
        <div className="pointer-events-auto absolute inset-y-0 left-80 right-0 z-10 flex items-center justify-center">
          <PosterPreview />
        </div>
      )}
    </div>
  );
}
