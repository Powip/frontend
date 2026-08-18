import type { DefaultValues } from "react-hook-form";
import {
  CURRENCIES,
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "../enums/sunat-document.enums";
import type { CreateSunatDocumentsFormValues } from "./create-sunat-documents.schema";

export const createSunatDocumentsDefaultValues: DefaultValues<CreateSunatDocumentsFormValues> = {
  documents: [
    {
      orderId: "",
      taxDocumentType: SUNAT_DOCUMENT_TYPES.INVOICE,
      series: "F001",

      customer: {
        name: "",
        identityDocumentType: undefined,
        identityDocumentNumber: "",
        countryCode: undefined,
        address: "",
      },

      totals: {
        currency: CURRENCIES.PEN,
        subtotal: 0,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        grandTotal: 0,
      },

      items: [
        {
          sku: "",
          productName: "",
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
          discountAmount: 0,
          unitCode: UNIT_CODES.UNIT,
          taxType: SUNAT_TAX_AFFECTATION_TYPES.GRAVADO,
        },
      ],
    },
  ],
};
