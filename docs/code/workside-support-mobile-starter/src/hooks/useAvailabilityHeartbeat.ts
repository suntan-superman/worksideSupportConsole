import { useEffect } from "react";
import { sendHeartbeat } from "@/services/supportApi";

export function useAvailabilityHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function beat() {
      if (!active) return;
      try {
        await sendHeartbeat();
      } catch {
        // Future diagnostics hook.
      }
    }

    beat();
    const interval = setInterval(beat, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled]);
}
