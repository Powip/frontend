// Modelo de permisos reales del módulo Operaciones.
//
// Por qué existe: hoy el único control de acceso real en Operaciones es un
// flag binario (¿es ADMIN o no?) que solo oculta "Exportar Excel" y "Aprobar
// pago". El mockup nuevo pide un selector "Ver como: Admin / Despacho / Call
// center" con permisos de verdad por rol.
//
// El backend (ms-auth) ya emite `auth.user.role` (uno de ADMINISTRADOR,
// AGENTES, VENTAS, OPERACIONES, COURIER, CALLER, además de ADMIN/OWNER/
// SUPERADMIN legacy) y `auth.user.permissions: string[]` dentro del JWT.
// En vez de inventar un sistema paralelo, este archivo define los permisos
// finos que Operaciones necesita (prefijo OPS_) para que backend los empiece
// a emitir en `permissions`, y mientras tanto calcula un fallback seguro a
// partir de `role` para que nadie quede bloqueado el día que se despliegue
// esto sin que el backend ya los esté mandando.
//
// Ver el informe de brechas de backend para el detalle de qué falta del lado
// del servidor (los endpoints hoy no validan nada de esto, solo el frontend).

export const OPS_PERMISSIONS = {
  /** Ver las pantallas del módulo (todas las tablas, sin poder mutar nada). */
  VIEW: "OPS_VIEW",
  /** Escanear, generar guía, agregar a guía, imprimir etiquetas — el trabajo de almacén. */
  DISPATCH: "OPS_DISPATCH",
  /** Confirmar/no-contesta/reprogramar llamada — la cola de confirmación pre-despacho. */
  CALL_MANAGEMENT: "OPS_CALL_MANAGEMENT",
  /** Cambiar el estado de un pedido a mano vía el <select> libre (individual o bulk). */
  CHANGE_STATUS_MANUAL: "OPS_CHANGE_STATUS_MANUAL",
  /** Anular un pedido con motivo. */
  CANCEL_ORDER: "OPS_CANCEL_ORDER",
  /** Aprobar guía, asignar/cambiar courier, liberar de guía. */
  MANAGE_GUIDES: "OPS_MANAGE_GUIDES",
  /** Aprobar/rechazar un pago registrado por otro (no registrar, eso es libre). */
  APPROVE_PAYMENTS: "OPS_APPROVE_PAYMENTS",
  /** Ver y trabajar Liquidaciones COD. */
  MANAGE_LIQUIDACIONES: "OPS_MANAGE_LIQUIDACIONES",
  /** Editar tarifario de couriers y credenciales de integraciones. */
  MANAGE_TARIFARIO: "OPS_MANAGE_TARIFARIO",
  /** Exportar a Excel. */
  EXPORT: "OPS_EXPORT",
  /** Reasignar el vendedor de un pedido. */
  REASSIGN_SELLER: "OPS_REASSIGN_SELLER",
} as const;

export type OpsPermission = (typeof OPS_PERMISSIONS)[keyof typeof OPS_PERMISSIONS];

const ALL_PERMISSIONS: OpsPermission[] = Object.values(OPS_PERMISSIONS);

export type OperationsViewRole = "ADMIN" | "DESPACHO" | "CALLCENTER";

export const OPERATIONS_VIEW_ROLE_LABEL: Record<OperationsViewRole, string> = {
  ADMIN: "Administrador",
  DESPACHO: "Despacho / Almacén",
  CALLCENTER: "Call center",
};

const ADMIN_ROLE_NAMES = ["ADMIN", "OWNER", "SUPERADMIN", "ADMINISTRADOR"];
const DESPACHO_ROLE_NAMES = ["OPERACIONES", "COURIER"];
// NOTA (confirmar con backend): el catálogo de roles trae "CALLER" con
// descripción "Integraciones externas" en el fallback local de
// UserForm.tsx — no está claro si es un rol humano de call center o una
// cuenta técnica de integración. Se incluye junto con "AGENTES" (el rol que
// sí se usa en Atención al Cliente/CC v2) hasta que se confirme. Ver informe
// de brechas de backend.
const CALLCENTER_ROLE_NAMES = ["CALLER", "AGENTES"];

/** Todo menos lo que hoy ya es exclusivo de ADMIN (exportar/aprobar) o nuevo y sensible (tarifario/liquidaciones). */
const ADMIN_ONLY_PERMISSIONS: OpsPermission[] = [
  OPS_PERMISSIONS.APPROVE_PAYMENTS,
  OPS_PERMISSIONS.MANAGE_LIQUIDACIONES,
  OPS_PERMISSIONS.MANAGE_TARIFARIO,
  OPS_PERMISSIONS.EXPORT,
];

/**
 * Fallback para roles que no mapean a ninguno de los 3 buckets (VENTAS,
 * roles desconocidos, o usuarios sin rol). Replica el comportamiento actual
 * en producción: cualquier autenticado puede hacer de todo salvo exportar y
 * aprobar pagos. Evita que este cambio bloquee a alguien el día 1.
 */
const DEFAULT_FALLBACK_PERMISSIONS: OpsPermission[] = ALL_PERMISSIONS.filter(
  (p) => !ADMIN_ONLY_PERMISSIONS.includes(p),
);

export const ROLE_BUCKET_PERMISSIONS_FOR_PREVIEW: Record<OperationsViewRole, OpsPermission[]> = {
  ADMIN: ALL_PERMISSIONS,
  DESPACHO: [
    OPS_PERMISSIONS.VIEW,
    OPS_PERMISSIONS.DISPATCH,
    OPS_PERMISSIONS.MANAGE_GUIDES,
    OPS_PERMISSIONS.CANCEL_ORDER,
    // Quien despacha y gestiona guías es quien cierra el ciclo marcando
    // "Entregado" — sin este permiso el botón de cambiar estado no se
    // renderizaba para el rol que más lo necesita (ver revisión de flujo
    // asignar guía → en camino → entregado).
    OPS_PERMISSIONS.CHANGE_STATUS_MANUAL,
  ],
  CALLCENTER: [
    OPS_PERMISSIONS.VIEW,
    OPS_PERMISSIONS.CALL_MANAGEMENT,
    OPS_PERMISSIONS.CANCEL_ORDER,
  ],
};

export function mapRoleNameToViewRole(roleName?: string | null): OperationsViewRole | null {
  if (!roleName) return null;
  const upper = roleName.toUpperCase();
  if (ADMIN_ROLE_NAMES.includes(upper)) return "ADMIN";
  if (DESPACHO_ROLE_NAMES.includes(upper)) return "DESPACHO";
  if (CALLCENTER_ROLE_NAMES.includes(upper)) return "CALLCENTER";
  return null;
}

/**
 * Deriva el set de permisos de Operaciones para un usuario.
 *
 * @param roleName        `auth.user.role` (string simple del JWT)
 * @param jwtPermissions  `auth.user.permissions` (array del JWT)
 * @param isSuperadminUser bypass total, igual que en el resto del app
 */
export function resolveOpsPermissions(
  roleName: string | undefined | null,
  jwtPermissions: string[] | undefined | null,
  isSuperadminUser: boolean,
): { viewRole: OperationsViewRole; permissions: Set<OpsPermission>; source: "jwt" | "role-fallback" } {
  if (isSuperadminUser) {
    return { viewRole: "ADMIN", permissions: new Set(ALL_PERMISSIONS), source: "jwt" };
  }

  const jwtHasOpsScope = (jwtPermissions ?? []).some((p) => p.startsWith("OPS_"));
  if (jwtHasOpsScope) {
    const granted = new Set(
      (jwtPermissions ?? []).filter((p): p is OpsPermission =>
        ALL_PERMISSIONS.includes(p as OpsPermission),
      ),
    );
    const viewRole = mapRoleNameToViewRole(roleName) ?? "DESPACHO";
    return { viewRole, permissions: granted, source: "jwt" };
  }

  const mappedRole = mapRoleNameToViewRole(roleName);
  if (mappedRole) {
    return {
      viewRole: mappedRole,
      permissions: new Set(ROLE_BUCKET_PERMISSIONS_FOR_PREVIEW[mappedRole]),
      source: "role-fallback",
    };
  }

  return {
    viewRole: "DESPACHO",
    permissions: new Set(DEFAULT_FALLBACK_PERMISSIONS),
    source: "role-fallback",
  };
}
