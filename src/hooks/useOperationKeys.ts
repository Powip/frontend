"use client";

import { useMemo, useRef } from "react";
import { newOperationId } from "@/lib/purchaseOrders";

// FEAT-24 H5-C / H6 — una clave de idempotencia (`operationId` / header
// `Idempotency-Key`) por acción: `get("despachar:<id>")` devuelve SIEMPRE la
// misma mientras la acción no termine bien, así el reintento de la misma acción
// (después de un error de red o un timeout) no la duplica en el servidor.
// `release` la descarta cuando se aplicó: la próxima vez es otra acción.

export interface OperationKeys {
  get(scope: string): string;
  release(scope: string): void;
}

export function useOperationKeys(): OperationKeys {
  const keys = useRef(new Map<string, string>());
  return useMemo(
    () => ({
      get(scope: string) {
        let key = keys.current.get(scope);
        if (!key) {
          key = newOperationId();
          keys.current.set(scope, key);
        }
        return key;
      },
      release(scope: string) {
        keys.current.delete(scope);
      },
    }),
    [],
  );
}
