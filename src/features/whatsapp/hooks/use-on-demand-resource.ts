"use client";

import { useCallback, useReducer, useRef } from "react";
import type { WhatsAppResourceState as ResourceState } from "../models/resource-state.model";

interface Entry<T> {
  state: ResourceState<T>;
  at: number;
}

/**
 * Convierte una consulta asíncrona en un lector síncrono `(input) => ResourceState`,
 * que es lo que esperan las vistas (vista previa de regla, conteo de segmento).
 * Cada entrada se pide una vez y se vuelve a pedir pasado `maxAgeMs`.
 */
export function useOnDemandResource<I, T>(
  toKey: (input: I) => string,
  fetcher: (input: I) => Promise<T>,
  errorMessage: string,
  maxAgeMs = 60_000,
): { read: (input: I) => ResourceState<T>; reset: () => void } {
  const cache = useRef(new Map<string, Entry<T>>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const read = useCallback(
    (input: I): ResourceState<T> => {
      const key = toKey(input);
      const hit = cache.current.get(key);
      const fresh = hit && (hit.state.kind === "loading" || Date.now() - hit.at < maxAgeMs);
      if (hit && fresh) return hit.state;
      const loading: ResourceState<T> = { kind: "loading" };
      cache.current.set(key, { state: loading, at: Date.now() });
      fetcherRef.current(input).then(
        (data) => {
          cache.current.set(key, { state: { kind: "ready", data }, at: Date.now() });
          rerender();
        },
        (error: unknown) => {
          const status = (error as { response?: { status?: number }; status?: number } | null);
          const code = status?.response?.status ?? status?.status;
          cache.current.set(key, {
            state: code === 403 ? { kind: "forbidden" } : { kind: "error", message: errorMessage },
            at: Date.now(),
          });
          rerender();
        },
      );
      return hit?.state.kind === "ready" ? hit.state : loading;
    },
    [errorMessage, maxAgeMs, toKey],
  );

  const reset = useCallback(() => {
    cache.current.clear();
    rerender();
  }, []);

  return { read, reset };
}
