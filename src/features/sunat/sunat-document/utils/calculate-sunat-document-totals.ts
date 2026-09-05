import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import { SUNAT_TAX_AFFECTATION_TYPES } from "../enums/sunat-document.enums";

export interface SunatTotalsInputItem {
  subtotal: number;
  discountAmount: number;
  taxType: string;
  quantity?: number;
  unitPrice?: number;
}

export interface SunatCalculatedTotals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Items contain NET (IGV-excluded) prices.
 *
 * Important rounding rule:
 *
 * We must calculate IGV from the FULL-PRECISION net amount and only round
 * the resulting tax afterwards.
 *
 * Example:
 *
 *   gross = 100
 *   net = 100 / 1.18 = 84.745762...
 *   rounded net = 84.75
 *   IGV from full precision = 15.254237...
 *   rounded IGV = 15.25
 *
 * Therefore:
 *
 *   84.75 + 15.25 = 100.00
 *
 * If IGV were calculated from the already-rounded 84.75, it would become
 * 15.26 and the final amount would incorrectly become 100.01.
 */
export function calculateSunatDocumentTotals<T extends SunatTotalsInputItem>(
  items: T[],
): SunatCalculatedTotals {
  let netTotalRaw = 0;
  let gravadoNetTotalRaw = 0;
  let discountTotalRaw = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    /*
     * Prefer quantity × unitPrice because unitPrice intentionally retains
     * full precision when the original sale price included IGV.
     *
     * This lets us reconstruct the exact unrounded net line amount before
     * calculating IGV.
     */
    const rawSubtotal =
      Number.isFinite(quantity) &&
      Number.isFinite(unitPrice) &&
      item.quantity !== undefined &&
      item.unitPrice !== undefined
        ? Math.max(0, quantity * unitPrice)
        : Number(item.subtotal) || 0;

    const discount = Math.max(0, Number(item.discountAmount) || 0);

    const taxableBaseRaw = Math.max(0, rawSubtotal - discount);

    netTotalRaw += taxableBaseRaw;
    discountTotalRaw += discount;

    if (item.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO) {
      gravadoNetTotalRaw += taxableBaseRaw;
    }
  }

  const subtotal = roundCurrency(netTotalRaw);

  /*
   * IMPORTANT:
   * Calculate IGV from the unrounded net total.
   * Do NOT use `subtotal * IGV_RATE`.
   */
  const taxTotal = roundCurrency(gravadoNetTotalRaw * IGV_RATE);

  const discountTotal = roundCurrency(discountTotalRaw);

  const grandTotal = roundCurrency(subtotal + taxTotal);

  return {
    subtotal,
    discountTotal,
    shippingTotal: 0,
    taxTotal,
    grandTotal,
  };
}
