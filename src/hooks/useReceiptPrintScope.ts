"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PrintDocumentOptions } from "@/utils/receiptUnitCodes";

/** Cancel private document work on close, unmount or an account/order change. */
export function useReceiptPrintScope(scopeKey: string, enabled: boolean) {
  const scope = useMemo(
    () => ({ key: scopeKey, enabled, operations: new Set<AbortController>() }),
    [scopeKey, enabled],
  );
  const current = useRef(scope);
  current.current = scope;
  useEffect(
    () => () => {
      for (const operation of scope.operations) operation.abort();
      scope.operations.clear();
    },
    [scope],
  );
  return useCallback((): PrintDocumentOptions & { release: () => void } => {
    const controller = new AbortController();
    if (!scope.enabled) controller.abort();
    scope.operations.add(controller);
    return {
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted && current.current === scope,
      release: () => scope.operations.delete(controller),
    };
  }, [scope]);
}
