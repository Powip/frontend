import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import { SUNAT_TAX_AFFECTATION_TYPES } from "../enums/sunat-document.enums";

export interface SunatTotalsInputItem {
  subtotal: number;
  discountAmount: number;
  taxType: string;
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

export function calculateSunatDocumentTotals<T extends SunatTotalsInputItem>(
  items: T[],
): SunatCalculatedTotals {
  const grossTotal = items.reduce((sum, item) => {
    const itemSubtotal = Number(item.subtotal) || 0;
    const itemDiscount = Number(item.discountAmount) || 0;
    return sum + Math.max(0, itemSubtotal - itemDiscount);
  }, 0);

  const discountTotal = roundCurrency(
    items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0),
  );

  const gravadoGrossTotal = items
    .filter((item) => item.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO)
    .reduce((sum, item) => {
      const itemSubtotal = Number(item.subtotal) || 0;
      const itemDiscount = Number(item.discountAmount) || 0;
      return sum + Math.max(0, itemSubtotal - itemDiscount);
    }, 0);

  const baseTaxable = roundCurrency(gravadoGrossTotal / (1 + IGV_RATE));
  const taxTotal = roundCurrency(gravadoGrossTotal - baseTaxable);
  const grandTotal = roundCurrency(grossTotal);
  const netSubtotal = roundCurrency(grandTotal - taxTotal);

  return {
    subtotal: netSubtotal,
    discountTotal,
    shippingTotal: 0,
    taxTotal,
    grandTotal,
  };
}
