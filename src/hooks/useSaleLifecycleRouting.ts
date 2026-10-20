"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { trackingError } from "@/services/inventoryTrackingService";
import type { UnitAssignmentState } from "@/services/saleTrackingService";
import {
  resolveSaleLifecycleTransition,
  type SaleUnitLifecycleAction,
} from "@/services/saleUnitLifecycleService";

/** Returns true when the caller must stop; false preserves its existing NONE action. */
export function useSaleLifecycleRouting() {
  const { auth } = useAuth();
  const scope = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const active = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const requests = active.current;
    return () => {
      for (const [key, controller] of requests) {
        if (key.startsWith(`${scope}:`)) {
          controller.abort();
          requests.delete(key);
        }
      }
    };
  }, [scope]);
  return useCallback(
    async (
      order: (UnitAssignmentState & { id: string; status: string }) | null | undefined,
      target: string,
      onTracked: (action: SaleUnitLifecycleAction) => void,
    ): Promise<boolean> => {
      if (!order) return false;
      const key = `${scope}:${order.id}`;
      if (active.current.has(key)) return true;
      const controller = new AbortController();
      active.current.set(key, controller);
      try {
        const action = await resolveSaleLifecycleTransition(order, target, controller.signal);
        if (controller.signal.aborted || currentScope.current !== scope) return true;
        if (action) {
          onTracked(action);
          return true;
        }
        return false;
      } catch (error) {
        if (!controller.signal.aborted && currentScope.current === scope)
          toast.error(trackingError(error, "No se pudo validar la venta. Inténtalo otra vez."));
        return true;
      } finally {
        if (active.current.get(key) === controller) active.current.delete(key);
      }
    },
    [scope],
  );
}
