import { useCallback, useEffect, useMemo, useState } from "react";

const TICK_MS = 1000;

export function useRetryCooldown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;

    const intervalId = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    }, TICK_MS);

    return () => clearInterval(intervalId);
  }, [until]);

  const start = useCallback((waitMs: number) => {
    const current = Date.now();
    setNow(current);
    setUntil(waitMs > 0 ? current + waitMs : null);
  }, []);

  const remainingMs = until === null ? 0 : Math.max(0, until - now);

  return useMemo(
    () => ({ isCoolingDown: remainingMs > 0, remainingMs, start }),
    [remainingMs, start],
  );
}
