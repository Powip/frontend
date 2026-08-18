import type { CreateSunatDocumentsRequestDto } from "../dto/create-sunat-documents-request.dto";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";

export function toCreateSunatDocumentsRequestDto(
  values: CreateSunatDocumentsFormValues,
): CreateSunatDocumentsRequestDto {
  return {
    documents: values.documents.map((document) => ({
      orderId: document.orderId,
      taxDocumentType: document.taxDocumentType,
      series: document.series,

      customer: document.customer
        ? {
            name: document.customer.name,
            identityDocumentType: document.customer.identityDocumentType,
            identityDocumentNumber: document.customer.identityDocumentNumber,
            countryCode: document.customer.countryCode,
            address: document.customer.address,
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
