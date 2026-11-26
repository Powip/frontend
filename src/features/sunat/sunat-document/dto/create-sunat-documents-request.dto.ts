import type { CountryCode } from "../../shared/enums/sunat.enums";
import type {
  Currency,
  IdentityDocumentType,
  SunatDocumentType,
  SunatTaxAffectationType,
  UnitCode,
} from "../enums/sunat-document.enums";

export interface SunatDocumentLineItemRequestDto {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  unitCode: UnitCode;
  taxType: SunatTaxAffectationType;
  /** Regalo (13/31): valor referencial unitario sin IGV. */
  referenceUnitValue?: number;
}

export interface SunatDocumentCustomerRequestDto {
  name?: string;
  identityDocumentType?: IdentityDocumentType;
  identityDocumentNumber?: string;
  countryCode?: CountryCode;
  address?: string;
}

export interface SunatDocumentTotalsRequestDto {
  currency: Currency;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface SunatDocumentRequestDto {
  orderId: string;
  taxDocumentType: SunatDocumentType;
  series: string;
  /** Issuer SUNAT profile (RUC). Omitted = the company's default profile. */
  sunatProfileId?: string;
  customer?: SunatDocumentCustomerRequestDto;
  totals: SunatDocumentTotalsRequestDto;
  items: SunatDocumentLineItemRequestDto[];
  /**
   * SUNAT document id of the invoice/receipt a credit or debit note amends.
   * Required for taxDocumentType 07/08 only.
   */
  referenceDocumentId?: string;
  /** SUNAT "sustento" (catalog 09 for credit notes). Required for 07/08 only. */
  reason?: { code: string; description: string };
}

export interface CreateSunatDocumentsRequestDto {
  documents: SunatDocumentRequestDto[];
}
