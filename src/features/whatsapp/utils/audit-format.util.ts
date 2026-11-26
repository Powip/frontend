import type { WhatsAppAuditValue } from "../models/settings-tab.model";

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|passwd|contrase|clave|credential|authorization|api[_-]?key|access[_-]?key|private/i;

export const REDACTED_LABEL = "Oculto por seguridad";
export const MISSING_VALUE_LABEL = "Sin dato";
export const AUDIT_VALUE_PREVIEW_LENGTH = 120;

/** Acción del registro de cambios en español (el backend guarda un código, p. ej. «update»). */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "creó",
  update: "editó",
  delete: "borró",
  activate: "activó",
  deactivate: "desactivó",
  auto_activate: "activó automáticamente",
  reactivate: "reactivó",
  connect: "conectó",
  disconnect: "desconectó",
  pause: "pausó",
  resume: "reanudó",
  test_send: "envió una prueba",
  resend: "reenvió un aviso",
  reply: "respondió",
  template: "envió una plantilla",
  assign: "asignó",
  attend: "marcó como atendida",
  contingency_update: "editó la contingencia",
  contingency_activate: "activó la contingencia",
  contingency_deactivate: "desactivó la contingencia",
  protection_update: "editó la protección",
  assisted_open: "abrió un aviso asistido",
  "assisted_mark-sent": "marcó como enviado",
  assisted_discard: "descartó un aviso asistido",
};

export function auditActionLabel(action: string): string {
  const label = AUDIT_ACTION_LABELS[action];
  if (label) return label;
  // Un código desconocido (solo letras sin tilde, guiones) nunca se muestra en inglés.
  return /^[a-z0-9_.-]+$/i.test(action) ? "hizo un cambio" : action;
}

/** Nombre de quien hizo el cambio y, aparte, su correo si es un dato distinto del nombre. */
export function auditUserLabel(user: { name?: string | null; email?: string | null } | null): {
  name: string;
  email: string | null;
} {
  const name = user?.name?.trim() || user?.email?.trim() || "Usuario sin informar";
  const email = user?.email?.trim() || null;
  return { name, email: email && email !== name ? email : null };
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactAuditValue(
  value: WhatsAppAuditValue | undefined,
): WhatsAppAuditValue | undefined {
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item) ?? null);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSensitiveKey(key) ? REDACTED_LABEL : (redactAuditValue(inner) ?? null),
      ]),
    );
  }
  return value;
}

export function formatAuditValue(value: WhatsAppAuditValue | undefined): string {
  if (value === null || value === undefined || value === "") return MISSING_VALUE_LABEL;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return value.toLocaleString("es-PE");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.length === 0 ? "Ninguno" : value.map((item) => formatAuditValue(item)).join(", ");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return MISSING_VALUE_LABEL;
  return entries.map(([key, inner]) => `${key}: ${formatAuditValue(inner)}`).join(" · ");
}

export interface AuditChange {
  key: string;
  before: string;
  after: string;
  changed: boolean;
  sensitive: boolean;
}

export function buildAuditChanges(
  before: Record<string, WhatsAppAuditValue> | null,
  after: Record<string, WhatsAppAuditValue> | null,
): AuditChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
  return keys.map((key) => {
    const sensitive = isSensitiveKey(key);
    const beforeValue = sensitive ? undefined : redactAuditValue(before?.[key]);
    const afterValue = sensitive ? undefined : redactAuditValue(after?.[key]);
    const beforeText =
      sensitive && before && key in before ? REDACTED_LABEL : formatAuditValue(beforeValue);
    const afterText =
      sensitive && after && key in after ? REDACTED_LABEL : formatAuditValue(afterValue);
    return {
      key,
      before: beforeText,
      after: afterText,
      changed: sensitive
        ? JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])
        : beforeText !== afterText,
      sensitive,
    };
  });
}

export function truncateAuditText(
  text: string,
  max = AUDIT_VALUE_PREVIEW_LENGTH,
): {
  preview: string;
  truncated: boolean;
} {
  if (text.length <= max) return { preview: text, truncated: false };
  return { preview: `${text.slice(0, max).trimEnd()}…`, truncated: true };
}
