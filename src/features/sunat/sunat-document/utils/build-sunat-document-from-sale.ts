import type { Order } from "@/models/sales/order";
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

  // An invoice requires a customer according to the schema.
  // A sales receipt may omit it.
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
    address: sale.customer.address,
  };
}

function createItems(sale: Order): SunatItem[] {
  const productItems: SunatItem[] = sale.items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const rawUnitPrice = Number(item.unitPrice) || 0;

    return {
      sku: item.sku ?? `PRODUCT-${item.id}`,
      productName: item.productName,
      quantity,
      unitPrice: rawUnitPrice,
      subtotal: roundCurrency(rawUnitPrice * quantity),
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType: SUNAT_TAX_AFFECTATION_TYPES.GRAVADO,
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

  return [
    ...productItems,
    {
      sku: "DELIVERY",
      productName: "Servicio de entrega",
      quantity: 1,
      unitPrice: shippingRawTotal,
      subtotal: shippingRawTotal,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType: shippingTaxType,
    },
  ];
}

function calculateItemSubtotals(items: SunatItem[]): SunatItem[] {
  return items.map((item) => ({
    ...item,
    subtotal: roundCurrency(Math.max(item.quantity, 0) * Math.max(item.unitPrice, 0)),
  }));
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
