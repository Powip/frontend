import { CdrStatus, Currency, DocumentType, IdentityDocumentType, TaxType, UnitCode } from "../types/sunat-document.types";

export interface CreateManualInvoiceRequestDto {
  externalId: string
  documentType: DocumentType;
  customer: InvoiceCustomerDto;
  totals: InvoiceTotalsDto;
  items: InvoiceItemDto[];
}

export interface InvoiceCustomerDto {
  name: string;
  documentType: IdentityDocumentType;
  documentNumber: string;
  address?: string;
}

export interface InvoiceItemDto {
  internalCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCode: UnitCode;
  taxType: TaxType;
}

export interface InvoiceTotalsDto {
  totalTax: number;
  totalValue: number;
  totalPrice: number;
  currency: Currency;
}

export interface CreateManualInvoiceResponseDto {
  success: boolean;
  message: string;
  data: ManualInvoiceResultResponseDto
}

export interface ManualInvoiceResultResponseDto {
  alreadyExists: boolean;
  series: string;
  correlative: number;
  cdr: CdrResponseResponseDto;
}

export interface CdrResponseResponseDto {
  accepted: boolean;
  status: CdrStatus;
  code: string;
  description: string;
  observations: string | null;
}


/**
 * Raw shape of a row in `sunat.sunat_documents`, exactly as returned by
 * GET /sunat-documents and GET /sunat-documents/external/:externalId.
 * These endpoints return the Supabase row directly (snake_case), with
 * no backend-side DTO mapping in between.
 */
export interface SunatDocumentRecordDto {
  id: string;
  external_id: string;
  company_id: string;
  document_type: DocumentType;
  series: string;
  correlative: string;
  issue_date: string;
  ruc_emisor: string;
  cdr_status: CdrStatus;
  sunat_code: string | null;
  sunat_description: string | null;
  observations: string | null;
  xml_url: string | null;
  cdr_url: string | null;
  cdr_path: string | null;
  digest_value: string | null;
  retry_attempts: number | null;
  invoice_payload: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface GetSunatDocumentsByCompanyResponseDto {
  success: boolean;
  count: number;
  data: SunatDocumentRecordDto[];
}

export interface GetSunatDocumentByExternalIdResponseDto {
  success: boolean;
  message?: string;
  data?: SunatDocumentRecordDto;
}
