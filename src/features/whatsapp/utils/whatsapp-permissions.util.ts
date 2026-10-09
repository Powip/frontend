import { PERMISSION_DEFINITIONS } from "../constants/whatsapp-settings-catalog";
import {
  WHATSAPP_PERMISSION_CODES,
  WHATSAPP_PERMISSION_ROLES,
  type WhatsAppPermissionCode,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppEffectivePermissions,
  WhatsAppPermissionMatrix,
} from "../models/settings-tab.model";

const ALL_CODES = Object.values(WHATSAPP_PERMISSION_CODES);

export function resolveEffectivePermissions(
  grantedCodes: readonly string[] | null,
): WhatsAppEffectivePermissions {
  const granted = grantedCodes ? new Set(grantedCodes) : null;
  return Object.fromEntries(
    ALL_CODES.map((code) => [code, granted ? granted.has(code) : null]),
  ) as WhatsAppEffectivePermissions;
}

export const UNKNOWN_PERMISSION_REASON =
  "Tus permisos de WhatsApp todavía no están confirmados por POWIP, así que esta acción queda bloqueada.";

export function getPermissionBlockReason(
  effective: WhatsAppEffectivePermissions,
  code: WhatsAppPermissionCode,
): string | null {
  const value = effective[code];
  if (value === true) return null;
  if (value === false) return "No tienes permiso para esta acción.";
  return UNKNOWN_PERMISSION_REASON;
}

export function getDocumentedPermissionMatrix(): WhatsAppPermissionMatrix {
  return Object.fromEntries(
    PERMISSION_DEFINITIONS.map((definition) => [definition.code, { ...definition.documented }]),
  ) as WhatsAppPermissionMatrix;
}

export function withAdminLocked(matrix: WhatsAppPermissionMatrix): WhatsAppPermissionMatrix {
  return Object.fromEntries(
    Object.entries(matrix).map(([code, roles]) => [
      code,
      { ...roles, [WHATSAPP_PERMISSION_ROLES.ADMIN]: true },
    ]),
  ) as WhatsAppPermissionMatrix;
}

export function countMatrixDifferences(
  a: WhatsAppPermissionMatrix,
  b: WhatsAppPermissionMatrix,
): number {
  let differences = 0;
  for (const definition of PERMISSION_DEFINITIONS) {
    for (const role of Object.values(WHATSAPP_PERMISSION_ROLES)) {
      if (a[definition.code][role] !== b[definition.code][role]) differences += 1;
    }
  }
  return differences;
}

export function combineBlockReasons(...reasons: (string | null | undefined)[]): string | null {
  const present = reasons.filter((reason): reason is string => !!reason);
  return present.length === 0 ? null : present.join(" ");
}
