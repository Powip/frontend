"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperadmin } from "@/config/permissions.config";
import {
  OPS_PERMISSIONS,
  OperationsViewRole,
  OpsPermission,
  resolveOpsPermissions,
  ROLE_BUCKET_PERMISSIONS_FOR_PREVIEW,
} from "@/config/operationsPermissions";

interface OperationsRoleContextValue {
  /** El rol real del usuario autenticado, calculado desde el JWT. */
  actualRole: OperationsViewRole;
  /** El rol que se está mostrando (puede ser una previsualización de un admin). */
  effectiveRole: OperationsViewRole;
  /** true si un admin está previsualizando otro rol ("Ver como"). */
  isPreviewing: boolean;
  /** Solo los ADMIN reales pueden usar "Ver como". No-op para el resto. */
  setPreviewRole: (role: OperationsViewRole | null) => void;
  /** ¿El usuario puede hacer X, según el rol efectivo (con preview aplicado)? */
  can: (permission: OpsPermission) => boolean;
  /** true si backend todavía no manda permisos OPS_* — o sea, estamos en modo fallback por nombre de rol. */
  isFallbackMode: boolean;
}

const OperationsRoleContext = createContext<OperationsRoleContextValue | null>(null);

export function OperationsRoleProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const [previewRole, setPreviewRoleState] = useState<OperationsViewRole | null>(null);

  const resolved = useMemo(
    () =>
      resolveOpsPermissions(
        auth?.user?.role,
        auth?.user?.permissions,
        isSuperadmin(auth?.user?.email),
      ),
    [auth?.user?.role, auth?.user?.permissions, auth?.user?.email],
  );

  const actualRole = resolved.viewRole;
  const canPreview = actualRole === "ADMIN";
  const effectiveRole = canPreview && previewRole ? previewRole : actualRole;

  const setPreviewRole = useCallback(
    (role: OperationsViewRole | null) => {
      if (!canPreview) return;
      setPreviewRoleState(role);
    },
    [canPreview],
  );

  const can = useCallback(
    (permission: OpsPermission) => {
      // Previsualizando: se filtra por lo que ese rol tendría, no por los
      // permisos reales del admin — así "Ver como Despacho" de verdad oculta
      // botones de admin en pantalla para poder revisar el diseño.
      if (canPreview && previewRole) {
        return ROLE_BUCKET_PERMISSIONS_FOR_PREVIEW[previewRole].includes(permission);
      }
      return resolved.permissions.has(permission);
    },
    [canPreview, previewRole, resolved.permissions],
  );

  const value: OperationsRoleContextValue = {
    actualRole,
    effectiveRole,
    isPreviewing: canPreview && !!previewRole && previewRole !== actualRole,
    setPreviewRole,
    can,
    isFallbackMode: resolved.source === "role-fallback",
  };

  return (
    <OperationsRoleContext.Provider value={value}>{children}</OperationsRoleContext.Provider>
  );
}

export function useOperationsRole(): OperationsRoleContextValue {
  const ctx = useContext(OperationsRoleContext);
  if (!ctx) {
    throw new Error("useOperationsRole debe usarse dentro de <OperationsRoleProvider>");
  }
  return ctx;
}

export { OPS_PERMISSIONS };
export type { OpsPermission, OperationsViewRole };
