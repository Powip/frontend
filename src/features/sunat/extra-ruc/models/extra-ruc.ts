/** status: PENDING | PAID | FAILED (ms-subscription). */
export type ExtraRucPurchaseStatus = "PENDING" | "PAID" | "FAILED";

/** Compra por adelantado de un RUC extra (S/ 15/mes). */
export interface ExtraRucPurchase {
  id: string;
  ruc: string;
  razonSocial: string;
  amount: number;
  currency: string;
  status: ExtraRucPurchaseStatus;
  /** Solo viene al crearla: ahí se manda al usuario a pagar en Flow. */
  redirectUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Último día pagado (yyyy-MM-dd). */
  activeUntil: string | null;
  /** Se cobra cada mes; false = dado de baja (vale hasta activeUntil). */
  renewing: boolean;
}

/** 1 RUC incluido + los extra pagados y vigentes. El cobro es siempre mensual, también en planes anuales. */
export interface ExtraRucSummary {
  includedRucs: number;
  extraRucsPaid: number;
  renewingRucs: number;
  maxRucs: number;
  /** Empresa exenta: sin límite de RUC. */
  unlimited: boolean;
  pricePerRuc: number;
  monthlyExtraTotal: number;
  currency: string;
  purchases: ExtraRucPurchase[];
}

export interface BuyExtraRucInput {
  ruc: string;
  razonSocial: string;
}
