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
  grossDiscount: number,
  taxType: SunatItem["taxType"],
  pricesIncludeTax: boolean,
): { unitPrice: number; subtotal: number; discountAmount: number } {
  const grossSubtotal = quantity * grossUnitPrice;

  if (taxType !== SUNAT_TAX_AFFECTATION_TYPES.GRAVADO || !pricesIncludeTax) {
    return {
      unitPrice: grossUnitPrice,
      subtotal: roundCurrency(grossSubtotal),
      discountAmount: grossDiscount,
    };
  }

  // Conservar precisión flotante completa tanto para unitPrice como para subtotal.
  // Evitar roundCurrency aquí previene descalces de centavos (+/- S/ 0.01) al reconstruir el IGV.
  const netSubtotal = grossSubtotal / (1 + IGV_RATE);
  const unitPrice = quantity > 0 ? netSubtotal / quantity : 0;

  // El descuento se cobró con IGV incluido, igual que el precio: SUNAT lo
  // resta del importe sin IGV, así que se convierte a neto con la misma
  // precisión completa (el IGV se calcula sobre base - descuento).
  return { unitPrice, subtotal: netSubtotal, discountAmount: grossDiscount / (1 + IGV_RATE) };
}

const toCents = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

/**
 * Reparte `totalCents` entre las líneas en proporción a su capacidad
 * (`capacities`), sin pasarse de la capacidad de ninguna y sin perder
 * centavos (método del mayor resto). Devuelve centavos por línea.
 */
function allocateByCapacity(totalCents: number, capacities: number[]): number[] {
  const capacityTotal = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const target = Math.min(Math.max(0, totalCents), capacityTotal);

  if (target === 0 || capacityTotal === 0) {
    return capacities.map(() => 0);
  }

  const exact = capacities.map((capacity) => (target * capacity) / capacityTotal);
  const shares = exact.map((value) => Math.floor(value));
  let remainder = target - shares.reduce((sum, share) => sum + share, 0);

  const byLargestFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const { index } of byLargestFraction) {
    if (remainder === 0) break;
    if (shares[index] < capacities[index]) {
      shares[index] += 1;
      remainder -= 1;
    }
  }

  return shares;
}

/**
 * Descuento que el pedido tiene en su cabecera pero que no quedó asignado a
 * ninguna línea de producto. Pasa, por ejemplo, con el envío gratis de
 * Shopify: el descuento es del envío, no de un producto, y Powip lo guarda en
 * `discountTotal` (el envío se conserva con su precio completo). Sin esto el
 * comprobante saldría más caro de lo que el cliente pagó.
 */
function getUnallocatedDiscountCents(sale: Order, lineDiscountCents: number[]): number {
  const allocated = lineDiscountCents.reduce((sum, cents) => sum + cents, 0);
  return Math.max(0, toCents(sale.discountTotal) - allocated);
}

function createItems(sale: Order): SunatItem[] {
  const pricesIncludeTax = sale.taxMode === "INCLUIDO";
  const taxType = SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;

  // Importes de la venta, en centavos y en bruto (tal como se cobraron).
  const grossLineCents = sale.items.map((item) =>
    toCents((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
  );

  const ownDiscountCents = sale.items.map((item, index) =>
    Math.min(Math.max(0, toCents(item.discountAmount)), grossLineCents[index]),
  );

  const shippingGrossCents = Math.max(0, toCents(sale.shippingTotal));

  // El descuento sin línea propia se aplica primero al envío (envío gratis) y
  // lo que sobre se reparte entre los productos.
  const unallocatedCents = getUnallocatedDiscountCents(sale, ownDiscountCents);
  const shippingDiscountCents = Math.min(unallocatedCents, shippingGrossCents);
  const sharedDiscountCents = allocateByCapacity(
    unallocatedCents - shippingDiscountCents,
    grossLineCents.map((gross, index) => gross - ownDiscountCents[index]),
  );

  const productItems: SunatItem[] = sale.items.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const rawUnitPrice = Number(item.unitPrice) || 0;
    const { unitPrice, subtotal, discountAmount } = toNetLineAmounts(
      quantity,
      rawUnitPrice,
      (ownDiscountCents[index] + sharedDiscountCents[index]) / 100,
      taxType,
      pricesIncludeTax,
    );

    return {
      sku: item.sku ?? `PRODUCT-${item.id}`,
      productName: item.productName,
      quantity,
      unitPrice,
      subtotal,
      discountAmount,
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
  const {
    unitPrice: shippingUnitPrice,
    subtotal: shippingSubtotal,
    discountAmount: shippingDiscountAmount,
  } = toNetLineAmounts(
    1,
    shippingRawTotal,
    shippingDiscountCents / 100,
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
      discountAmount: shippingDiscountAmount,
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
