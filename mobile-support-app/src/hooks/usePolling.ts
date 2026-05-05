import { useEffect, useRef } from "react";

export function usePolling(callback: () => Promise<void> | void, intervalMs: number) {
  const callbackRef = useRef(callback);
  const busyRef = useRef(false);

  callbackRef.current = callback;

  useEffect(() => {
    let active = true;

    const interval = setInterval(async () => {
      if (!active || busyRef.current) return;
      busyRef.current = true;
      try {
        await callbackRef.current();
      } catch {
        // Polling callbacks own their user-facing error behavior.
      } finally {
        busyRef.current = false;
      }
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [intervalMs]);
}
