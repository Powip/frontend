import type { Order } from "@/features/sales/models/order";
import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import {
  SUNAT_TAX_AFFECTATION_TYPES,
  type SunatTaxAffectationType,
} from "../enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";

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

/** The shipping line the builder adds: it is never a gift. */
const SHIPPING_SKU = "DELIVERY";

type CandidateItem = Pick<
  SunatItem,
  "sku" | "quantity" | "unitPrice" | "discountAmount" | "taxType" | "giftSale"
>;

/**
 * A line that can be sent as a gift, judged by what it holds NOW, so editing
 * price or discount on screen adds or removes it:
 * - it is already going as a gift (13/31);
 * - its value is S/ 0.00 (price 0 or 100% discount);
 * - the sale marked it as a gift and its amounts were not changed.
 */
export function isGiftCandidate(item: CandidateItem): boolean {
  if (item.sku === SHIPPING_SKU) {
    return false;
  }

  if (isGiftTaxType(item.taxType)) {
    return true;
  }

  const quantity = Number(item.quantity) || 0;

  // An empty quantity is a field being typed, not a gift.
  if (quantity <= 0) {
    return false;
  }

  const unitPrice = Number(item.unitPrice) || 0;
  const discountAmount = Number(item.discountAmount) || 0;

  if (Number((quantity * unitPrice - discountAmount).toFixed(2)) <= 0) {
    return true;
  }

  const sale = item.giftSale;

  return (
    sale?.isGift === true && sale.unitPrice === unitPrice && sale.discountAmount === discountAmount
  );
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
 */
export function getAllowedGiftModes(items: readonly SunatItem[]): GiftMode[] {
  return isGiftOnlyDocument(items)
    ? [GIFT_MODES.APARTE]
    : [GIFT_MODES.PROMOCION, GIFT_MODES.APARTE];
}

/** The option every candidate line is going with; `none` if any is left out. */
export function getCurrentGiftMode(items: readonly SunatItem[]): GiftMode {
  const candidates = items.filter(isGiftCandidate);
  const mode = candidates[0]?.taxType;

  return isGiftTaxType(mode) && candidates.every((item) => item.taxType === mode)
    ? (mode as GiftMode)
    : GIFT_MODES.NONE;
}

/**
 * Suggested valor referencial (without IGV) when the user has not typed one:
 * the sale's gift value, else the line's own price (100% discount), else the
 * price the sale had (line edited down to 0). Never a half-typed amount.
 */
function suggestReferenceUnitValue(item: SunatItem): number | undefined {
  const suggested = item.giftSale?.referenceUnitValue || item.unitPrice || item.giftSale?.unitPrice;

  return suggested && suggested > 0 ? suggested : undefined;
}

/**
 * Sends the candidate lines as gifts (`mode` 13/31) or back as they were
 * before choosing (`none`). A gift is charged nothing: price, subtotal and
 * discount go to 0, so its discount never reaches the document's discount
 * total, and SUNAT gets its value through `referenceUnitValue`. A normal
 * price typed by the user survives; a suggested one is computed again.
 */
export function applyGiftMode(items: readonly SunatItem[], mode: GiftMode): SunatItem[] {
  return items.map((item) => {
    if (mode === GIFT_MODES.NONE) {
      const origin = item.giftOrigin;

      if (!origin) {
        return item;
      }

      return {
        ...item,
        taxType: origin.taxType,
        unitPrice: origin.unitPrice,
        subtotal: Math.max(0, item.quantity * origin.unitPrice),
        discountAmount: origin.discountAmount,
        referenceUnitValue:
          item.referenceUnitValue === origin.suggestedValue ? undefined : item.referenceUnitValue,
        giftOrigin: undefined,
      };
    }

    if (!isGiftCandidate(item)) {
      return item;
    }

    if (item.giftOrigin) {
      return { ...item, taxType: mode };
    }

    const suggestedValue = item.referenceUnitValue ? undefined : suggestReferenceUnitValue(item);

    return {
      ...item,
      taxType: mode,
      unitPrice: 0,
      subtotal: 0,
      discountAmount: 0,
      referenceUnitValue: item.referenceUnitValue ?? suggestedValue,
      giftOrigin: {
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxType: item.taxType,
        suggestedValue,
      },
    };
  });
}

/** Normal price per unit, IGV included, as the user knows it. */
export function getGiftNormalUnitPrice(
  item: Pick<SunatItem, "referenceUnitValue">,
): number | undefined {
  const value = item.referenceUnitValue;

  return value && value > 0 ? round2(value * (1 + IGV_RATE)) : undefined;
}

/** Valor referencial per unit, WITHOUT IGV, from the normal price with IGV. */
export function toReferenceUnitValue(normalUnitPriceWithIgv: number): number | undefined {
  return normalUnitPriceWithIgv > 0 ? normalUnitPriceWithIgv / (1 + IGV_RATE) : undefined;
}

/** Valor referencial of the whole line, without IGV, at 2 decimals. */
export function getGiftLineValue(item: Pick<SunatItem, "referenceUnitValue" | "quantity">): number {
  return round2((Number(item.referenceUnitValue) || 0) * (Number(item.quantity) || 0));
}

/** IGV that the company pays for its «regalo aparte» lines (13). */
export function getCompanyPaidGiftIgv(items: readonly SunatItem[]): number {
  return round2(
    items
      .filter((item) => item.taxType === GIFT_MODES.APARTE)
      .reduce((sum, item) => sum + round2(getGiftLineValue(item) * IGV_RATE), 0),
  );
}

/** Gift lines still without a normal price: they cannot be issued with value 0. */
export function getGiftsWithoutPrice(items: readonly SunatItem[]): SunatItem[] {
  return items.filter((item) => isGiftTaxType(item.taxType) && getGiftLineValue(item) <= 0);
}

/**
 * Keeps on each product line what the sale had, so that the screen can later
 * suggest the normal price of a gift: its price and discount, whether it was
 * marked as a gift, and the gift's value (`giftValue` is the whole line),
 * all without IGV. Shipping is added afterwards and is never a gift.
 */
export function rememberSaleAmounts(productItems: SunatItem[], sale: Order): SunatItem[] {
  const pricesIncludeTax = sale.taxMode === "INCLUIDO";

  return productItems.map((item, index) => {
    const saleItem = sale.items[index];

    if (!saleItem) {
      return item;
    }

    const giftValue = Number(saleItem.giftValue) || 0;
    const unitValue = item.quantity > 0 ? giftValue / item.quantity : 0;

    return {
      ...item,
      giftSale: {
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        isGift: Boolean(saleItem.isGift),
        referenceUnitValue:
          unitValue > 0 ? (pricesIncludeTax ? unitValue / (1 + IGV_RATE) : unitValue) : undefined,
      },
    };
  });
}
