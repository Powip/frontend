import { useEffect, useRef, useState } from "react";

interface UseTickingNowOptions {
  baseNow?: Date;
  intervalMs: number;
  nextChangeAt?: Date | null;
  enabled?: boolean;
}

function readNow(baseTime: number | null, mountedAt: number): Date {
  return baseTime === null ? new Date() : new Date(baseTime + (Date.now() - mountedAt));
}

export function useTickingNow({
  baseNow,
  intervalMs,
  nextChangeAt = null,
  enabled = true,
}: UseTickingNowOptions): Date {
  const mountedAtRef = useRef(Date.now());
  const baseTime = baseNow?.getTime() ?? null;
  const nextChangeTime = nextChangeAt?.getTime() ?? null;
  const [now, setNow] = useState<Date>(() => readNow(baseTime, mountedAtRef.current));

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(readNow(baseTime, mountedAtRef.current));
    tick();
    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, baseTime]);

  useEffect(() => {
    if (!enabled || nextChangeTime === null) return;
    const delay = nextChangeTime - readNow(baseTime, mountedAtRef.current).getTime();
    if (delay <= 0) return;
    const timeout = setTimeout(() => setNow(readNow(baseTime, mountedAtRef.current)), delay + 50);
    return () => clearTimeout(timeout);
  }, [enabled, nextChangeTime, baseTime]);

  return now;
}
