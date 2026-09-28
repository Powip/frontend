import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import {
  PANEL_ROLE_PERMISSION_CLAIMS,
  PANEL_ROLES,
  type PanelRoleResolution,
} from "../models/panel-role.model";

interface RoleInput {
  email?: string | null;
  role?: string | null;
  permissions?: string[] | null;
}

const JWT_ROLE_TO_PANEL: Record<string, { role: "confirmadora" | "vendedora"; evidencia: string }> =
  {
    AGENTES: {
      role: "confirmadora",
      evidencia:
        "Rol AGENTES: catálogo de usuarios 'Personal de agentes' y bucket CALLCENTER de operationsPermissions",
    },
    VENTAS: {
      role: "vendedora",
      evidencia:
        "Rol VENTAS: catálogo de usuarios 'Personal de ventas'; los pedidos filtran por sellerId = id del usuario",
    },
  };

const ROLES_SIN_EQUIVALENCIA: Record<string, string> = {
  CALLER:
    "El catálogo lo describe como 'Integraciones externas'; no hay evidencia de que sea una confirmadora",
  OPERACIONES:
    "La especificación no define una vista para Operaciones; Supervisora no tiene un rol propio en el JWT",
  COURIER: "La especificación no define una vista para Courier",
};

export function resolvePanelRole({ email, role, permissions }: RoleInput): PanelRoleResolution {
  if (isSuperadmin(email ?? undefined)) {
    return {
      status: "resuelto",
      role: "dueno",
      source: "superadmin",
      evidencia: "Email en la lista SUPERADMIN_EMAILS",
    };
  }

  const claims = permissions ?? [];
  const byClaim = PANEL_ROLES.find((panelRole) =>
    claims.includes(PANEL_ROLE_PERMISSION_CLAIMS[panelRole]),
  );
  if (byClaim) {
    return {
      status: "resuelto",
      role: byClaim,
      source: "permiso_panel",
      evidencia: `Permiso ${PANEL_ROLE_PERMISSION_CLAIMS[byClaim]} en el JWT`,
    };
  }

  if (hasAdminAccess(role ?? undefined)) {
    return {
      status: "resuelto",
      role: "dueno",
      source: "rol_jwt",
      evidencia: `Rol ${role} incluido en ADMIN_ROLES de permissions.config`,
    };
  }

  const normalized = (role ?? "").toUpperCase();
  const mapped = JWT_ROLE_TO_PANEL[normalized];
  if (mapped) {
    return {
      status: "resuelto",
      role: mapped.role,
      source: "rol_jwt",
      evidencia: mapped.evidencia,
    };
  }

  return {
    status: "sin_resolver",
    rolJwt: role ?? null,
    motivo:
      ROLES_SIN_EQUIVALENCIA[normalized] ??
      "El rol no tiene equivalente comprobable en el panel. Se necesita el permiso PANEL_ROL_* en el JWT",
  };
}
