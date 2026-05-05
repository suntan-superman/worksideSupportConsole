import { useEffect } from "react";
import { AppState } from "react-native";
import { sendHeartbeat } from "@/services/supportApi";

export function useAvailabilityHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function beat() {
      if (!active) return;
      if (AppState.currentState !== "active") return;
      try {
        await sendHeartbeat();
      } catch {
        // Future diagnostics hook.
      }
    }

    beat();
    const interval = setInterval(beat, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") beat();
    });

    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);
}
