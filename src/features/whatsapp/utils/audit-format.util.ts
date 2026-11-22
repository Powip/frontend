import type { WhatsAppAuditValue } from "../models/settings-tab.model";

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|passwd|contrase|clave|credential|authorization|api[_-]?key|access[_-]?key|private/i;

export const REDACTED_LABEL = "Oculto por seguridad";
export const MISSING_VALUE_LABEL = "Sin dato";
export const AUDIT_VALUE_PREVIEW_LENGTH = 120;

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
