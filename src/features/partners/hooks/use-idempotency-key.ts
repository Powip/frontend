import { useCallback, useMemo, useRef } from "react";
import { createIdempotencyKey } from "../utils/create-idempotency-key";

export function useIdempotencyKey() {
  const keysRef = useRef(new Map<string, string>());

  const resolve = useCallback((payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    const current = keysRef.current.get(fingerprint);

    if (current) {
      return current;
    }

    const key = createIdempotencyKey();
    keysRef.current.set(fingerprint, key);
    return key;
  }, []);

  const reset = useCallback((payload?: unknown) => {
    if (payload === undefined) {
      keysRef.current.clear();
      return;
    }
    keysRef.current.delete(JSON.stringify(payload));
  }, []);

  return useMemo(() => ({ resolve, reset }), [resolve, reset]);
}
