import { useState } from "react";
import Globe from "@/components/Globe/Globe";
import GlobeControls from "@/components/Globe/GlobeControls";
import CitySearch from "@/components/Search/CitySearch";
import DatasetPicker from "@/components/UI/DatasetPicker";
import ScaleBar from "@/components/UI/ScaleBar";
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

      {/* === GLOBE MODE overlay controls === */}
      {mode === "globe" && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Top-left cluster: title + search */}
          <div className="pointer-events-auto absolute left-5 top-5 flex flex-col gap-3">
            <h1
              className="cursor-pointer select-none text-[11px] font-medium tracking-[0.25em] text-white/50 transition-colors hover:text-white/70"
              onClick={handleBackToGlobe}
            >
              TERRAINPOSTER
            </h1>
            <CitySearch />
          </div>

          {/* Bottom-left: dataset pills + globe controls */}
          <div className="pointer-events-auto absolute bottom-6 left-5 flex flex-col gap-3">
            <DatasetPicker />
            <GlobeControls />
          </div>

          {/* Bottom-center: Generate Poster action */}
          <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={handleGeneratePoster}
              disabled={!city}
              className={`
                rounded-full px-6 py-2 text-xs font-medium tracking-wide transition-all duration-300
                ${
                  city
                    ? "bg-white/10 text-white/90 shadow-lg shadow-black/20 backdrop-blur-md hover:bg-white/20 hover:shadow-xl border border-white/10"
                    : "pointer-events-none opacity-0"
                }
              `}
            >
              Generate Poster
            </button>
          </div>

          {/* Bottom-right: scale bar */}
          <div className="pointer-events-none absolute bottom-6 right-5">
            <ScaleBar />
          </div>
        </div>
      )}

      {/* === POSTER MODE === */}
      {mode === "poster" && (
        <div className="absolute inset-0 z-10 flex">
          {/* Left panel — slides in */}
          <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/5 bg-black/60 p-5 backdrop-blur-xl animate-slide-in">
            <button
              onClick={handleBackToGlobe}
              className="group flex items-center gap-2 self-start text-[11px] tracking-[0.25em] text-white/40 transition-colors hover:text-white/70"
            >
              <svg
                className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              TERRAINPOSTER
            </button>

            <StyleControls />
            <ExportButton />
          </div>

          {/* Poster preview — fills remaining space */}
          <div className="flex flex-1 items-center justify-center">
            <PosterPreview />
          </div>
        </div>
      )}
    </div>
  );
}
