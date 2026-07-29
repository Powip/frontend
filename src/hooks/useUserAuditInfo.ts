"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * `{ userId, sellerName }` que casi todas las mutaciones de Operaciones
 * mandan al backend para trazabilidad. Estaba duplicado (idéntico) en
 * operaciones/page.tsx, centro-envios/page.tsx, ventas/page.tsx, finanzas/page.tsx
 * y ShipmentDetailModal.tsx — se centraliza acá para el módulo nuevo.
 */
export function useUserAuditInfo() {
  const { auth } = useAuth();

  return useCallback(
    () => ({
      userId: auth?.user?.id,
      sellerName:
        [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
        undefined,
    }),
    [auth?.user?.id, auth?.user?.name, auth?.user?.surname],
  );
}
