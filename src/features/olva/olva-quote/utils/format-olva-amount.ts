import type { OlvaCurrency } from "../../shared/constants/olva-enums.constants";

/** 12.5 + "PEN" -> "S/ 12.50" (es-PE). */
export function formatOlvaAmount(amount: number, currency: OlvaCurrency): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount);
}
