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
  customer?: SunatDocumentCustomerRequestDto;
  totals: SunatDocumentTotalsRequestDto;
  items: SunatDocumentLineItemRequestDto[];
}

export interface CreateSunatDocumentsRequestDto {
  documents: SunatDocumentRequestDto[];
}
