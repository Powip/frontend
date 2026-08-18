import type { CountryCode } from "../../shared/enums/sunat.enums";
import type {
  Currency,
  IdentityDocumentType,
  SunatDocumentCdrStatus,
  SunatDocumentType,
  SunatTaxAffectationType,
  UnitCode,
} from "../enums/sunat-document.enums";

export interface SunatDocumentCustomerResponseDto {
  name?: string;
  identityDocumentType?: IdentityDocumentType;
  identityDocumentNumber?: string;
  countryCode?: CountryCode;
  address?: string;
}

export interface SunatDocumentLineItemResponseDto {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  unitCode: UnitCode;
  taxType: SunatTaxAffectationType;
}

export interface SunatDocumentTotalsResponseDto {
  currency: Currency;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface SunatDocumentPayloadResponseDto {
  customer?: SunatDocumentCustomerResponseDto;
  totals: SunatDocumentTotalsResponseDto;
  items: SunatDocumentLineItemResponseDto[];
}

export interface SunatDocumentResponseDto {
  id: string;
  orderId: string;
  companyId: string;
  rucIssuer: string;

  taxDocumentType: SunatDocumentType;
  series: string;
  correlative: string;
  issueDate: string;

  cdrStatus: SunatDocumentCdrStatus;

  sunatCode: string | null;
  sunatDescription: string | null;
  observations: string | null;

  signedXmlStoragePath: string | null;
  cdrStoragePath: string | null;
  digestValue: string | null;

  taxDocumentPayload: SunatDocumentPayloadResponseDto;

  referenceDocumentId: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface SunatDocumentBulkErrorResponseDto {
  orderId: string;

  error: {
    code: string;
    message: string;
  };
}

export type SunatDocumentBulkResultResponseDto =
  | SunatDocumentResponseDto
  | SunatDocumentBulkErrorResponseDto;

export interface CreateSunatDocumentsResponseDto {
  results: SunatDocumentBulkResultResponseDto[];
}
