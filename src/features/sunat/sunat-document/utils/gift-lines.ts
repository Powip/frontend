import type { Order } from "@/features/sales/models/order";
import { isNuevoRus } from "@/features/sunat/sunat-profile/utils/tax-regime";
import {
  SUNAT_TAX_AFFECTATION_TYPES,
  type SunatTaxAffectationType,
} from "../enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";
import { getIssuerIgvRate } from "./nuevo-rus";

type SunatItem = CreateSunatDocumentsFormValues["documents"][number]["items"][number];

/**
 * How the company sends the gifts of an order (Catálogo 07):
 * - 31 «regalo de promoción»: goes with the purchase, no IGV.
 * - 13 «regalo aparte»: the customer pays S/ 0 and the company pays the IGV.
 * - none: not declared as a gift (a line at S/ 0.00 then blocks the document).
 *
 * Code 21 is not used for gifts (decision with the accountant).
 */
export const GIFT_MODES = {
  NONE: "none",
  PROMOCION: SUNAT_TAX_AFFECTATION_TYPES.REGALO_PROMOCION,
  APARTE: SUNAT_TAX_AFFECTATION_TYPES.REGALO_APARTE,
} as const;

export type GiftMode = (typeof GIFT_MODES)[keyof typeof GIFT_MODES];

const GIFT_TAX_TYPES: readonly string[] = [GIFT_MODES.PROMOCION, GIFT_MODES.APARTE];

export function isGiftTaxType(taxType: SunatTaxAffectationType | string | undefined): boolean {
  return taxType !== undefined && GIFT_TAX_TYPES.includes(taxType);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A line that can be sent as a gift: it was marked when the order was read. */
export function isGiftCandidate(item: Pick<SunatItem, "giftOrigin">): boolean {
  return item.giftOrigin !== undefined;
}

export function hasGiftCandidates(items: readonly SunatItem[]): boolean {
  return items.some(isGiftCandidate);
}

/** Every line is a gift: the document goes for S/ 0.00. */
export function isGiftOnlyDocument(items: readonly SunatItem[]): boolean {
  return items.length > 0 && items.every(isGiftCandidate);
}

/**
 * A gift-only document can only be a «regalo aparte» (13): a «regalo de
 * promoción» (31) needs a purchase to go with.
 *
 * A Nuevo RUS issuer never uses 13 (the issuer pays IGV, which its boleta
 * must not show): its gifts go only as 31, so a gift-only document has no
 * option there.
 */
export function getAllowedGiftModes(
  items: readonly SunatItem[],
  taxRegime?: string | null,
): GiftMode[] {
  if (isNuevoRus(taxRegime)) {
    return isGiftOnlyDocument(items) ? [] : [GIFT_MODES.PROMOCION];
  }

  return isGiftOnlyDocument(items)
    ? [GIFT_MODES.APARTE]
    : [GIFT_MODES.PROMOCION, GIFT_MODES.APARTE];
}

export function getCurrentGiftMode(items: readonly SunatItem[]): GiftMode {
  const gift = items.find((item) => isGiftCandidate(item) && isGiftTaxType(item.taxType));

  return (gift?.taxType as GiftMode | undefined) ?? GIFT_MODES.NONE;
}

/**
 * Sends the candidate lines as gifts (`mode` 13/31) or back as the sale had
 * them (`none`). A gift is charged nothing: price, subtotal and discount go
 * to 0, so its discount never reaches the document's discount total, and
 * SUNAT gets its value through `referenceUnitValue`.
 */
export function applyGiftMode(items: readonly SunatItem[], mode: GiftMode): SunatItem[] {
  return items.map((item) => {
    const origin = item.giftOrigin;

    if (!origin) {
      return item;
    }

    if (mode === GIFT_MODES.NONE) {
      return {
        ...item,
        taxType: origin.taxType,
        unitPrice: origin.unitPrice,
        subtotal: Math.max(0, item.quantity * origin.unitPrice),
        discountAmount: origin.discountAmount,
      };
    }

    return { ...item, taxType: mode, unitPrice: 0, subtotal: 0, discountAmount: 0 };
  });
}

/**
 * Normal price per unit, IGV included, as the user knows it. A Nuevo RUS
 * issuer has no IGV: its normal price is the valor referencial.
 */
export function getGiftNormalUnitPrice(
  item: Pick<SunatItem, "referenceUnitValue">,
  taxRegime?: string | null,
): number | undefined {
  const value = item.referenceUnitValue;

  return value && value > 0 ? round2(value * (1 + getIssuerIgvRate(taxRegime))) : undefined;
}

/** Valor referencial per unit, WITHOUT IGV, from the normal price with IGV. */
export function toReferenceUnitValue(
  normalUnitPriceWithIgv: number,
  taxRegime?: string | null,
): number | undefined {
  return normalUnitPriceWithIgv > 0
    ? normalUnitPriceWithIgv / (1 + getIssuerIgvRate(taxRegime))
    : undefined;
}

/** Valor referencial of the whole line, without IGV, at 2 decimals. */
export function getGiftLineValue(item: Pick<SunatItem, "referenceUnitValue" | "quantity">): number {
  return round2((Number(item.referenceUnitValue) || 0) * (Number(item.quantity) || 0));
}

/** IGV that the company pays for its «regalo aparte» lines (13). */
export function getCompanyPaidGiftIgv(
  items: readonly SunatItem[],
  taxRegime?: string | null,
): number {
  const rate = getIssuerIgvRate(taxRegime);

  return round2(
    items
      .filter((item) => item.taxType === GIFT_MODES.APARTE)
      .reduce((sum, item) => sum + round2(getGiftLineValue(item) * rate), 0),
  );
}

/** Gift lines still without a normal price: they cannot be issued with value 0. */
export function getGiftsWithoutPrice(items: readonly SunatItem[]): SunatItem[] {
  return items.filter((item) => isGiftTaxType(item.taxType) && getGiftLineValue(item) <= 0);
}

/**
 * Marks the product lines that can go as a gift, keeping what they had so the
 * choice can be undone:
 * - a line the sale marked as a gift (`isGift`);
 * - a line at price 0;
 * - a line with a real price and a 100% discount.
 *
 * Its suggested valor referencial (without IGV) comes from the gift's normal
 * price in the sale (`giftValue`, the whole line) or from its own price when
 * it was discounted 100%. A line at price 0 without `giftValue` gets none:
 * the user must type the normal price. Shipping (free shipping included) is
 * never a gift and is not touched here.
 */
export function markGiftCandidates(
  productItems: SunatItem[],
  sale: Order,
  taxRegime?: string | null,
): SunatItem[] {
  const igvRate = getIssuerIgvRate(taxRegime);
  const pricesIncludeTax = sale.taxMode === "INCLUIDO";

  return productItems.map((item, index) => {
    const saleItem = sale.items[index];
    const lineValue = round2(item.quantity * item.unitPrice - item.discountAmount);

    if (!saleItem || (!saleItem.isGift && lineValue > 0)) {
      return item;
    }

    const giftValue = Number(saleItem.giftValue) || 0;
    let referenceUnitValue: number | undefined;

    if (giftValue > 0 && item.quantity > 0) {
      const unitValue = giftValue / item.quantity;
      referenceUnitValue = pricesIncludeTax ? unitValue / (1 + igvRate) : unitValue;
    } else if (item.unitPrice > 0) {
      referenceUnitValue = item.unitPrice;
    }

    return {
      ...item,
      ...(referenceUnitValue ? { referenceUnitValue } : {}),
      giftOrigin: {
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxType: item.taxType,
      },
    };
  });
}
