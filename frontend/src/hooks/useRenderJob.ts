import { useEffect, useRef } from "react";
import { connectRenderProgress } from "@/api/client";
import { usePosterStore } from "@/stores/posterStore";

export function useRenderJob(jobId: string | null) {
  const updateRenderStatus = usePosterStore((s) => s.updateRenderStatus);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = connectRenderProgress(jobId, (status) => {
      updateRenderStatus(status);

      // Close on terminal states
      if (status.status === "done" || status.status === "error") {
        ws.close();
      }
    });

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId, updateRenderStatus]);

  const renderStatus = usePosterStore((s) => s.renderStatus);
  const renderProgress = usePosterStore((s) => s.renderProgress);
  const renderImageUrl = usePosterStore((s) => s.renderImageUrl);

  return {
    status: renderStatus,
    progress: renderProgress,
    imageUrl: renderImageUrl,
  };
}
