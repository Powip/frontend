import type { CreateSunatDocumentsRequestDto } from "../dto/create-sunat-documents-request.dto";
import { SUNAT_DOCUMENT_TYPES } from "../enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";

// SUNAT's UBL 2.1 schema requires cac:PartyLegalEntity/cbc:RegistrationName to be
// non-empty AND format-valid on every document, even an anonymous boleta with no
// identified buyer. A bare "-" was tried and rejected by the OSE with error 2022
// ("El dato ingresado no cumple con el estandar"), so a real name-shaped string
// is required. "Cliente Varios" matches the example already used as the
// customer-name field's own placeholder hint in this form, confirming it's the
// accepted convention here.
const ANONYMOUS_CUSTOMER_NAME_PLACEHOLDER = "Consumidor Final";

// Blank text inputs surface as "" (not null/undefined), so a plain `?? undefined`
// lets an empty string through untouched.
function toOptionalTrimmedString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toCustomerName(
  name: string | null | undefined,
  taxDocumentType: CreateSunatDocumentsFormValues["documents"][number]["taxDocumentType"],
): string | undefined {
  const trimmed = toOptionalTrimmedString(name);

  if (trimmed) {
    return trimmed;
  }

  // Invoices always require a real customer name (enforced by the schema
  // before we even get here), so only boletas fall back to the placeholder.
  return taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT
    ? ANONYMOUS_CUSTOMER_NAME_PLACEHOLDER
    : undefined;
}

export function toCreateSunatDocumentsRequestDto(
  values: CreateSunatDocumentsFormValues,
): CreateSunatDocumentsRequestDto {
  return {
    documents: values.documents.map((document) => ({
      orderId: document.orderId,
      taxDocumentType: document.taxDocumentType,
      series: document.series,

      customer:
        document.customer || document.taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT
          ? {
              name: toCustomerName(document.customer?.name, document.taxDocumentType),
              identityDocumentType: document.customer?.identityDocumentType ?? undefined,
              identityDocumentNumber: toOptionalTrimmedString(
                document.customer?.identityDocumentNumber,
              ),
              countryCode: document.customer?.countryCode ?? undefined,
              address: toOptionalTrimmedString(document.customer?.address),
            }
          : undefined,

      totals: {
        currency: document.totals.currency,
        subtotal: document.totals.subtotal,
        discountTotal: document.totals.discountTotal,
        shippingTotal: document.totals.shippingTotal,
        taxTotal: document.totals.taxTotal,
        grandTotal: document.totals.grandTotal,
      },

      items: document.items.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        discountAmount: item.discountAmount,
        unitCode: item.unitCode,
        taxType: item.taxType,
      })),
    })),
  };
}
