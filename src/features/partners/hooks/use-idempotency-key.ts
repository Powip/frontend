import { useCallback, useMemo, useRef } from "react";
import { createIdempotencyKey } from "../utils/create-idempotency-key";

interface IdempotencyKeyEntry {
  key: string;
  fingerprint: string;
}

export function useIdempotencyKey() {
  const entryRef = useRef<IdempotencyKeyEntry | null>(null);

  const resolve = useCallback((payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    const current = entryRef.current;

    if (current && current.fingerprint === fingerprint) {
      return current.key;
    }

    const next = { key: createIdempotencyKey(), fingerprint };
    entryRef.current = next;
    return next.key;
  }, []);

  const reset = useCallback(() => {
    entryRef.current = null;
  }, []);

  return useMemo(() => ({ resolve, reset }), [resolve, reset]);
}
