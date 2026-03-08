import { PALETTES } from "@/types";
import { usePosterStore } from "@/stores/posterStore";

interface ProgressBarProps {
  progress: number;
  statusText: string;
}

export default function ProgressBar({ progress, statusText }: ProgressBarProps) {
  const palette = usePosterStore((s) => s.palette);
  const colors = PALETTES[palette];
  const gradient = `linear-gradient(to right, ${colors.join(", ")})`;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-white/50">
        <span>{statusText}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: gradient,
          }}
        />
      </div>
    </div>
  );
}
