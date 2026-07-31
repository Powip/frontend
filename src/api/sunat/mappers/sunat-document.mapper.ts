import { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";
import { CreateManualInvoiceRequestDto, SunatDocumentRecordDto } from "../dto/sunat-document.dto";
import { SunatDocument } from "@/models/sunat/sunat-document";
import { AxiosResponse } from "axios";
import { DownloadedFile } from "@/models/sunat/downloaded-file";
import { SunatInvoicePayload } from "@/models/sunat/sunat-invoice-payload";

export function toCreateManualInvoiceRequestDto(
  input: CreateManualInvoiceInput
): CreateManualInvoiceRequestDto {
  return {
    externalId: input.externalId,
    documentType: input.documentType,
    customer: {
      name: input.customer.name,
      documentType: input.customer.documentType,
      documentNumber: input.customer.documentNumber,
      address: input.customer.address,
    },
    totals: {
      totalTax: input.totals.totalTax,
      totalValue: input.totals.totalValue,
      totalPrice: input.totals.totalPrice,
      currency: input.totals.currency,
    },
    items: input.items.map(item => ({
      internalCode: item.internalCode,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCode: item.unitCode,
      taxType: item.taxType,
    })),
  };
}


export function toSunatDocument(dto: SunatDocumentRecordDto): SunatDocument {
  return {
    id: dto.id,
    externalId: dto.external_id,
    companyId: dto.company_id,
    documentType: dto.document_type,
    series: dto.series,
    correlative: dto.correlative,
    issueDate: new Date(dto.issue_date),
    rucEmisor: dto.ruc_emisor,
    cdrStatus: dto.cdr_status,
    sunatCode: dto.sunat_code,
    sunatDescription: dto.sunat_description,
    observations: dto.observations,
    xmlUrl: dto.xml_url,
    cdrUrl: dto.cdr_url,
    retryAttempts: dto.retry_attempts ?? 0,
    invoicePayload: dto.invoice_payload
      ? (JSON.parse(dto.invoice_payload) as SunatInvoicePayload)
      : null,
    createdAt: new Date(dto.created_at),
    updatedAt: dto.updated_at ? new Date(dto.updated_at) : null,
  };
}

export function toSunatDocuments(dtos: SunatDocumentRecordDto[]): SunatDocument[] {
  return dtos.map(toSunatDocument);
}

/**
 * The pdf/:externalId endpoint sets Content-Disposition explicitly
 * (attachment; filename="..."); the xml/:externalId redirect lands on
 * a Supabase signed URL that already has its own `download` param
 * baked in server-side (see getSignedUrl), so both responses carry a
 * usable filename here — this just parses it out generically.
 */
export function toDownloadedFile(response: AxiosResponse<Blob>): DownloadedFile {
  const disposition = response.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : null;

  return { blob: response.data, filename };
}
