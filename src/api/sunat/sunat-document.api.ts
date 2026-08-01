import axiosAuth from "@/lib/axiosAuth";
// import { GATEWAY } from "@/lib/gateway";
import { API } from "@/lib/api";
import {
  CreateManualInvoiceRequestDto,
  CreateManualInvoiceResponseDto,
  GetSunatDocumentByExternalIdResponseDto,
  GetSunatDocumentsByCompanyResponseDto,
} from "./dto/sunat-document.dto";
import { AxiosResponse } from "axios";

export async function createManualInvoice(
  dto: CreateManualInvoiceRequestDto
): Promise<CreateManualInvoiceResponseDto> {
  const { data } =
    await axiosAuth.post<CreateManualInvoiceResponseDto>(
      // `${GATEWAY.integrations}/sunat-documents/generate-manual`,
      `${API.integrations}/sunat-documents/generate-manual`,
      dto
    );

  return data;
}

/**
 * Comprobantes de la compañía autenticada (scope viene del JWT en el
 * backend, no hace falta pasar companyId/storeId aquí).
 */
export async function getSunatDocumentsByCompany(): Promise<
  GetSunatDocumentsByCompanyResponseDto
> {
  const { data } =
    await axiosAuth.get<GetSunatDocumentsByCompanyResponseDto>(
      // `${GATEWAY.integrations}/sunat-documents`
      `${API.integrations}/sunat-documents`,
    );

  return data;
}

export async function getSunatDocumentByExternalId(
  externalId: string
): Promise<GetSunatDocumentByExternalIdResponseDto> {
  const { data } =
    await axiosAuth.get<GetSunatDocumentByExternalIdResponseDto>(
      // `${GATEWAY.integrations}/sunat-documents/external/${externalId}`
      `${API.integrations}/sunat-documents/external/${externalId}`
    );

  return data;
}

/**
 * These return binary content (PDF) or a redirect to a signed storage
 * URL (XML), not JSON — must go through axiosAuth (not a bare <a href>)
 * because the endpoint is authenticated via the Authorization header,
 * which a plain anchor tag never sends. responseType: "blob" is what
 * lets axios hand back the raw bytes (and follow the XML redirect
 * transparently) instead of trying to JSON-parse the response.
 */
export async function downloadComprobantePdf(
  externalId: string
): Promise<AxiosResponse<Blob>> {
  return axiosAuth.get<Blob>(
    // `${GATEWAY.integrations}/sunat-documents/pdf/${externalId}`,
    `${API.integrations}/sunat-documents/pdf/${externalId}`,
    { responseType: "blob" }
  );
}

export async function downloadComprobanteXml(
  externalId: string
): Promise<AxiosResponse<Blob>> {
  return axiosAuth.get<Blob>(
    // `${GATEWAY.integrations}/sunat-documents/xml/${externalId}`,
    `${API.integrations}/sunat-documents/xml/${externalId}`,
    { responseType: "blob" }
  );
}
