"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";

export const ADMIN_ONLY_NOTICE = "Solo un administrador puede ver esta sección";

/**
 * Muestra el contenido solo a administradores. Quien no lo es ve el aviso y los
 * hijos ni se montan, así que no se llama a ningún endpoint.
 */
export default function EquipoAdminGate({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  if (!hasAdminAccess(auth?.user.role)) {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground"
      >
        <Lock className="h-5 w-5" />
        <p>{ADMIN_ONLY_NOTICE}</p>
      </div>
    );
  }
  return <>{children}</>;
}
