import { useQuery } from "@tanstack/react-query";
import { getHeightmap } from "@/api/client";
import { usePosterStore } from "@/stores/posterStore";
import type { HeightmapResponse } from "@/types";

export function useGlobeData() {
  const dataset = usePosterStore((s) => s.dataset);

  return useQuery<HeightmapResponse>({
    queryKey: ["globe-heightmap", dataset],
    queryFn: () =>
      getHeightmap({
        lat: 0,
        lon: 0,
        radius_km: 20000,
        dataset,
        resolution: "20km",
      }),
  });
}
