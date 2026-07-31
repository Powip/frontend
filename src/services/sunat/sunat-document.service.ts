import { CreateManualInvoiceResponseDto } from "@/api/sunat/dto/sunat-document.dto";
import { toCreateManualInvoiceRequestDto, toDownloadedFile, toSunatDocuments } from "@/api/sunat/mappers/sunat-document.mapper";
import { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";
import * as api from "@/api/sunat/sunat-document.api";
import { SunatDocument } from "@/models/sunat/sunat-document";
import { DownloadedFile } from "@/models/sunat/downloaded-file";

export async function createManualInvoice(
  input: CreateManualInvoiceInput
): Promise<CreateManualInvoiceResponseDto> {
  const requestDto = toCreateManualInvoiceRequestDto(input);

  return api.createManualInvoice(requestDto);
}

export async function getSunatDocumentsByCompany(): Promise<SunatDocument[]> {
  const responseDto = await api.getSunatDocumentsByCompany();

  return toSunatDocuments(responseDto.data);
}

export async function downloadTaxDocumentPdf(
  externalId: string
): Promise<DownloadedFile> {
  const response = await api.downloadComprobantePdf(externalId);

  return toDownloadedFile(response);
}

export async function downloadTaxDocumentXml(
  externalId: string
): Promise<DownloadedFile> {
  const response = await api.downloadComprobanteXml(externalId);

  return toDownloadedFile(response);
}
