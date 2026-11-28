import type { CountryCode } from "../../shared/enums/sunat.enums";
import type {
  Currency,
  IdentityDocumentType,
  SunatDocumentCdrStatus,
  SunatDocumentType,
  SunatDocumentVoidStatus,
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
  /** Regalo (13/31): valor referencial unitario sin IGV. */
  referenceUnitValue?: number;
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
  /** Credit/debit notes only: SUNAT reason (catalog 09/10). */
  discrepancyResponse?: { reasonCode: string; reasonDescription: string };
  /** The document is an anticipo (advance payment). */
  isPrepayment?: boolean;
  /** Final document: anticipos it deducts. Its totals are already net of them. */
  prepayments?: SunatDocumentPrepaymentResponseDto[];
}

/** Anticipo deducted by a final document (snapshot stored by the backend). */
export interface SunatDocumentPrepaymentResponseDto {
  documentId: string;
  taxDocumentType: "01" | "03";
  series: string;
  correlative: string;
  rucIssuer: string;
  issueDate: string;
  taxType: "10" | "20" | "30";
  /** Base without IGV. */
  taxableAmount: number;
  taxAmount: number;
  /** Total paid with the anticipo. */
  amount: number;
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

  /** Comunicación de baja: null until someone asks to void it. */
  voidStatus: SunatDocumentVoidStatus | null;
  voidReason: string | null;
  voidRequestedAt: string | null;
  voidTicket: string | null;
  voidSunatCode: string | null;
  voidSunatDescription: string | null;
  voidedAt: string | null;
  /** Last day (yyyy-mm-dd) SUNAT accepts the comunicación de baja. */
  voidDeadline: string;
  /** "Dar de baja" can be offered today (backend rule). */
  voidable: boolean;

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
