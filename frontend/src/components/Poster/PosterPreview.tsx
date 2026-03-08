import { usePosterStore } from "@/stores/posterStore";
import ProgressBar from "@/components/UI/ProgressBar";

export default function PosterPreview() {
  const city = usePosterStore((s) => s.city);
  const title = usePosterStore((s) => s.title);
  const font = usePosterStore((s) => s.font);
  const backgroundColor = usePosterStore((s) => s.backgroundColor);
  const renderStatus = usePosterStore((s) => s.renderStatus);
  const renderProgress = usePosterStore((s) => s.renderProgress);
  const renderImageUrl = usePosterStore((s) => s.renderImageUrl);

  const fontFamily =
    font === "serif"
      ? "Georgia, serif"
      : font === "mono"
        ? "ui-monospace, monospace"
        : "system-ui, sans-serif";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Poster frame */}
      <div
        className="relative flex aspect-[3/4] w-full max-w-md items-center justify-center overflow-hidden rounded-lg border border-white/10 shadow-2xl"
        style={{ backgroundColor }}
      >
        {renderStatus === "done" && renderImageUrl ? (
          <>
            <img
              src={renderImageUrl}
              alt="Rendered poster"
              className="h-full w-full object-contain"
            />
            {/* Title overlay */}
            <div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-12 text-center"
              style={{ fontFamily }}
            >
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                {title || city?.name || ""}
              </h2>
            </div>
          </>
        ) : renderStatus === "queued" || renderStatus === "rendering" ? (
          <div className="flex w-full flex-col items-center gap-4 px-8">
            <p className="text-sm text-white/60">
              {renderStatus === "queued"
                ? "Queued..."
                : `Rendering... ${renderProgress}%`}
            </p>
            <ProgressBar
              progress={renderProgress}
              statusText={renderStatus === "queued" ? "Queued" : "Rendering"}
            />
          </div>
        ) : renderStatus === "error" ? (
          <div className="flex flex-col items-center gap-2 px-8 text-center">
            <p className="text-red-400">Render failed</p>
            <p className="text-xs text-white/40">
              Please try again with different settings
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <p className="text-lg text-white/60" style={{ fontFamily }}>
              {city?.name || "Select a city"}
            </p>
            <p className="text-xs text-white/30">
              Click Generate to preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
