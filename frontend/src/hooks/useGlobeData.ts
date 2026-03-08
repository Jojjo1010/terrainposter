import { useQuery } from "@tanstack/react-query";
import { getHeightmap } from "@/api/client";
import { usePosterStore } from "@/stores/posterStore";
import type { HeightmapResponse } from "@/types";

export interface UseGlobeDataOptions {
  /** Only fetch when the globe is visible (default: true) */
  enabled?: boolean;
}

/**
 * Fetches the 20 km global heightmap used for the globe data overlay.
 *
 * - Hits POST /api/heightmap (backend at localhost:8000, proxied via Vite)
 * - Refetches when the dataset changes
 * - Returns `null` data on error instead of crashing
 */
export function useGlobeData(options: UseGlobeDataOptions = {}) {
  const { enabled = true } = options;
  const dataset = usePosterStore((s) => s.dataset);

  return useQuery<HeightmapResponse | null>({
    queryKey: ["globe-heightmap", dataset],
    queryFn: async () => {
      try {
        return await getHeightmap({
          lat: 0,
          lon: 0,
          radius_km: 20000,
          dataset,
          resolution: "20km",
        });
      } catch (err) {
        console.error("[useGlobeData] Failed to fetch heightmap:", err);
        return null;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
