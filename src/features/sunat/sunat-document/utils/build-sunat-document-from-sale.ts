import type { Order } from "@/features/sales/models/order";
import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import { COUNTRY_CODES } from "../../shared/enums/sunat.enums";
import {
  CURRENCIES,
  IDENTITY_DOCUMENT_TYPES,
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "../enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";
import { calculateSunatDocumentTotals } from "./calculate-sunat-document-totals";

type SunatDocument = CreateSunatDocumentsFormValues["documents"][number];

type SunatItem = SunatDocument["items"][number];

type SunatCustomer = NonNullable<SunatDocument["customer"]>;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDocumentTypeFromSale(sale: Order): SunatDocument["taxDocumentType"] {
  return sale.customer?.documentType === "RUC"
    ? SUNAT_DOCUMENT_TYPES.INVOICE
    : SUNAT_DOCUMENT_TYPES.SALES_RECEIPT;
}

function getCustomerIdentityDocumentType(
  documentType: Order["customer"]["documentType"],
): SunatCustomer["identityDocumentType"] {
  switch (documentType) {
    case "DNI":
      return IDENTITY_DOCUMENT_TYPES.DNI;

    case "CARNET":
      return IDENTITY_DOCUMENT_TYPES.CARNET_EXTRANJERIA;

    case "PASAPORTE":
      return IDENTITY_DOCUMENT_TYPES.PASAPORTE;

    case "RUC":
      return IDENTITY_DOCUMENT_TYPES.RUC;
  }
}

function createCustomer(
  sale: Order,
  taxDocumentType: SunatDocument["taxDocumentType"],
): SunatDocument["customer"] {
  if (!sale.customer) {
    return undefined;
  }

  // An invoice requires a customer (including fiscal address) per the schema,
  // and the emission form has a dedicated "Dirección Fiscal" field for it.
  //
  // A sales receipt (boleta) may omit the customer entirely, and even when
  // identified (>= S/700) SUNAT only requires name + identity document, never
  // an address — the form has no address field for boletas at all. So the
  // order's delivery address must NOT be carried over here: it's private
  // shipping info the customer never agreed to have printed on the tax
  // document, and since there's no form field for it on a boleta, the user
  // has no way to review or clear it before emitting.
  if (taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE) {
    return {
      name: sale.customer.fullName,
      identityDocumentType: getCustomerIdentityDocumentType(sale.customer.documentType),
      identityDocumentNumber: sale.customer.documentNumber,
      countryCode: COUNTRY_CODES.PERU,
      address: sale.customer.address,
    };
  }

  return {
    name: sale.customer.fullName,
    identityDocumentType: getCustomerIdentityDocumentType(sale.customer.documentType),
    identityDocumentNumber: sale.customer.documentNumber,
    countryCode: COUNTRY_CODES.PERU,
  };
}

/**
 * SUNAT's UBL requires `unitPrice` to be the NET price (IGV excluded) — see
 * `calculateLineTax`/`buildDocumentLine` on the sunat-integration side, which
 * assume exactly that and compute the IGV-inclusive reference price by
 * *adding* 18% on top.
 *
 * But at sale-registration time, the seller chooses per-order whether the
 * prices they typed in already include IGV or not (`Order.taxMode`):
 * - "INCLUIDO": prices are gross (IGV baked in) — must be divided down to net.
 * - "AUTOMATICO": prices are already net, IGV gets added on top separately —
 *   no adjustment needed here.
 *
 * Only GRAVADO items carry IGV at all; other tax categories have no tax
 * component, so gross and net are the same value for them regardless of
 * taxMode.
 *
 * Critically, this converts at the LINE level (quantity × unitPrice), not
 * the per-unit level. Dividing a single unit's gross price by 1.18 and
 * *then* rounding to currency precision loses a cent for some quantities —
 * e.g. a gross unit price of 140 with quantity 2: rounding 140/1.18=118.64
 * first and multiplying by 2 gives 237.28, but rounding the true gross LINE
 * total (280/1.18=237.29) once gives the correct 237.29. That stray cent is
 * exactly what showed up as an off-by-.01 grandTotal. The returned
 * `unitPrice` is deliberately left at full precision (not rounded to 2
 * decimals) — `calculateItemSubtotals` below multiplies it back out by the
 * same quantity, and only rounds once, at the end, so it reconstructs this
 * exact `subtotal` instead of compounding a second rounding error.
 */
function toNetLineAmounts(
  quantity: number,
  grossUnitPrice: number,
  taxType: SunatItem["taxType"],
  pricesIncludeTax: boolean,
): { unitPrice: number; subtotal: number } {
  const grossSubtotal = quantity * grossUnitPrice;

  if (taxType !== SUNAT_TAX_AFFECTATION_TYPES.GRAVADO || !pricesIncludeTax) {
    return { unitPrice: grossUnitPrice, subtotal: roundCurrency(grossSubtotal) };
  }

  // Conservar precisión flotante completa tanto para unitPrice como para subtotal.
  // Evitar roundCurrency aquí previene descalces de centavos (+/- S/ 0.01) al reconstruir el IGV.
  const netSubtotal = grossSubtotal / (1 + IGV_RATE);
  const unitPrice = quantity > 0 ? netSubtotal / quantity : 0;

  return { unitPrice, subtotal: netSubtotal };
}

function createItems(sale: Order): SunatItem[] {
  const pricesIncludeTax = sale.taxMode === "INCLUIDO";

  const productItems: SunatItem[] = sale.items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const taxType = SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;
    const rawUnitPrice = Number(item.unitPrice) || 0;
    const { unitPrice, subtotal } = toNetLineAmounts(
      quantity,
      rawUnitPrice,
      taxType,
      pricesIncludeTax,
    );

    return {
      sku: item.sku ?? `PRODUCT-${item.id}`,
      productName: item.productName,
      quantity,
      unitPrice,
      subtotal,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType,
    };
  });

  const shippingRawTotal = Number(sale.shippingTotal ?? 0);

  if (shippingRawTotal <= 0) {
    return productItems;
  }

  const shippingTaxType = productItems.some(
    (item) => item.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO,
  )
    ? SUNAT_TAX_AFFECTATION_TYPES.GRAVADO
    : SUNAT_TAX_AFFECTATION_TYPES.INAFECTO;

  // Shipping is always quantity 1, so there's no per-unit-vs-line rounding
  // difference to worry about here — but routing it through the same
  // helper keeps the conversion logic in exactly one place.
  const { unitPrice: shippingUnitPrice, subtotal: shippingSubtotal } = toNetLineAmounts(
    1,
    shippingRawTotal,
    shippingTaxType,
    pricesIncludeTax,
  );

  return [
    ...productItems,
    {
      sku: "DELIVERY",
      productName: "Servicio de entrega",
      quantity: 1,
      unitPrice: shippingUnitPrice,
      subtotal: shippingSubtotal,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType: shippingTaxType,
    },
  ];
}

function calculateItemSubtotals(items: SunatItem[]): SunatItem[] {
  return items.map((item) => {
    const qty = Math.max(item.quantity, 0);
    const price = Math.max(item.unitPrice, 0);
    return {
      ...item,
      subtotal: qty * price,
    };
  });
}

function calculateTotals(items: SunatItem[]) {
  return {
    currency: CURRENCIES.PEN,
    ...calculateSunatDocumentTotals(items),
  };
}

export function buildSunatDocumentFromSale(sale: Order): SunatDocument {
  const taxDocumentType = getDocumentTypeFromSale(sale);

  const items = calculateItemSubtotals(createItems(sale));

  return {
    orderId: String(sale.id),

    taxDocumentType,

    series: taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE ? "F001" : "B001",

    customer: createCustomer(sale, taxDocumentType),

    totals: calculateTotals(items),

    items,
  };
}
