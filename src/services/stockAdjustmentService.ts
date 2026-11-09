import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H0 — ajuste manual con motivo. Va por la fachada autenticada de
// ms-products (/tracking), que toma empresa y usuario del token.
export type AdjustmentReason = "dano" | "vencimiento" | "robo" | "error_registro" | "muestra" | "otro";

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  dano: "Daño",
  vencimiento: "Vencimiento",
  robo: "Robo",
  error_registro: "Error de registro",
  muestra: "Muestra",
  otro: "Otro",
};

export interface StockAdjustmentInput {
  inventoryItemId: string;
  direction: "IN" | "OUT";
  quantity: number;
  reason: AdjustmentReason;
  note?: string;
}

export interface StockAdjustmentResult {
  inventoryItemId: string;
  quantity: number;
  reservedQuantity: number;
  reservedWithoutStock: number;
}

export async function adjustStock(input: StockAdjustmentInput): Promise<StockAdjustmentResult> {
  const { data } = await axiosAuth.post<StockAdjustmentResult>(
    `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/tracking/stock-adjustments`,
    input,
  );
  return data;
}
