import type { WarehouseType } from "@/services/warehousesService";

// FEAT-24 H1-A — textos compartidos por la pantalla de almacenes y su formulario.

/** Tipos de almacén: valor que viaja al backend y etiqueta para el usuario. */
export const WAREHOUSE_TYPE_OPTIONS: ReadonlyArray<{ value: WarehouseType; label: string }> = [
  { value: "PROPIO", label: "Propio" },
  { value: "TIENDA", label: "Tienda" },
  { value: "COURIER", label: "Courier" },
];

/**
 * La fachada `/warehouses` explica el motivo del rechazo en
 * `error.response.data.message` (el `message` de axios es genérico). Nest puede
 * devolver un texto o una lista de textos (validación de DTO).
 */
export function warehouseErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data
    ?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim() !== "");
    if (parts.length > 0) return parts.join(". ");
  }
  if (typeof message === "string" && message.trim() !== "") return message;
  return fallback;
}
