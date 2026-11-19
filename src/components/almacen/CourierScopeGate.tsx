"use client";

import type { ReactNode } from "react";
import { isCourierRole } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";

// FEAT-24 H8-D5 — el portal del courier es FAIL-CLOSED, como la fachada: un
// usuario COURIER sin almacén asignado no ve nada (con H6, «sin asignaciones»
// significaría ver todos). Si /me/warehouses no responde (por ejemplo, sin
// señal) no se bloquea: el servidor igual responde 403 a lo que no es suyo.

export const COURIER_WITHOUT_WAREHOUSE = "Tu usuario de courier no tiene un almacén asignado. Pídele al Administrador que te lo asigne en Configuración › Usuarios y almacenes.";

function CourierScope({ children }: { children: ReactNode }) {
  const scope = useMyWarehouses();
  if (scope.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Cargando tu almacén…</p>;
  if (scope.known && (scope.all || scope.visibleIds.size === 0))
    return (
      <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        {COURIER_WITHOUT_WAREHOUSE}
      </p>
    );
  return <>{children}</>;
}

export default function CourierScopeGate({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  if (!isCourierRole(auth?.user?.role)) return <>{children}</>;
  return <CourierScope>{children}</CourierScope>;
}
