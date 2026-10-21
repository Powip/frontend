import type { Lead, LeadFieldDefinition } from "@/types/leads";

export const LEAD_STATUS_LABELS = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  SEGUIMIENTO: "En seguimiento",
  PERDIDO: "Perdido",
  CONVERTIDO: "Convertido en venta",
} as const;
export const leadIsOpen = (lead: Lead) =>
  !["PERDIDO", "CONVERTIDO"].includes(lead.status);
export function leadMoney(amount: unknown, currency?: string | null): string {
  if (
    amount === null ||
    amount === undefined ||
    amount === "" ||
    !Number.isFinite(Number(amount))
  )
    return "Sin importe estimado";
  return `${currency ?? "Moneda sin definir"} ${Number(amount).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function leadDate(value?: string | null): string {
  return value && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toLocaleString("es-PE")
    : "Sin fecha";
}
export function leadCommandId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function leadCustomValues(
  fields: LeadFieldDefinition[],
  values: Record<string, unknown>,
) {
  return Object.fromEntries(
    fields
      .filter((field) => values[field.key] !== "" && values[field.key] != null)
      .map((field) => [
        field.key,
        field.type === "number"
          ? Number(values[field.key])
          : field.type === "boolean"
            ? values[field.key] === true || values[field.key] === "true"
            : String(values[field.key]),
      ]),
  );
}
export const LEAD_ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Lead registrado",
  INTAKE_CAPTURED: "Entrada recibida",
  UPDATED: "Datos actualizados",
  CONTACTADO: "Contacto realizado",
  SEGUIMIENTO: "Seguimiento",
  NOTA: "Nota",
  LOST: "Lead perdido",
  REOPENED: "Lead reabierto",
  PURCHASE_CONFIRMED: "Compra confirmada por vendedor",
  WEB_PREPAID_CONFIRMED: "Venta web con prepago aprobado",
  CONTACT_COMPLETED_FROM_ORDER: "Contacto completado desde pedido",
  SELLER_REASSIGNED: "Vendedor reasignado",
};
