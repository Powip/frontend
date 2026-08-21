import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { DownloadFileResult } from "@/types/download-file.types";
import { extractFilename } from "@/utils/http/extract-filename";
import type { BulkPdfRequestDto } from "../dto/bulk-pdf-request.dto";
import type { CreateSunatDocumentsRequestDto } from "../dto/create-sunat-documents-request.dto";
import type { ListSunatDocumentsQueryDto } from "../dto/list-sunat-documents-query.dto";
import type { ListSunatDocumentsResponseDto } from "../dto/list-sunat-documents-response.dto";
import type {
  CreateSunatDocumentsResponseDto,
  SunatDocumentResponseDto,
} from "../schemas/sunat-documents-response.dto";

export async function createSunatDocumentsApi(
  requestDto: CreateSunatDocumentsRequestDto,
): Promise<CreateSunatDocumentsResponseDto> {
  const { data } = await axiosAuth.post<CreateSunatDocumentsResponseDto>(
    // `${GATEWAY.integrations}/sunat-documents`,
    `${API.sunat}/api/v1/sunat-documents`,
    requestDto,
  );

  return data;
}

export async function listSunatDocumentsApi(
  query: ListSunatDocumentsQueryDto,
): Promise<ListSunatDocumentsResponseDto> {
  const { data } = await axiosAuth.get<ListSunatDocumentsResponseDto>(
    `${API.sunat}/api/v1/sunat-documents`,
    {
      params: query,
    },
  );

  return data;
}

export async function getSunatDocumentApi(id: string): Promise<SunatDocumentResponseDto> {
  const { data } = await axiosAuth.get<SunatDocumentResponseDto>(
    `${API.sunat}/api/v1/sunat-documents/${id}`,
  );

  return data;
}

export async function getSunatDocumentPdfApi(id: string): Promise<DownloadFileResult> {
  const response = await axiosAuth.get<Blob>(`${API.sunat}/api/v1/sunat-documents/${id}/pdf`, {
    responseType: "blob",
  });

  return {
    blob: response.data,
    filename: extractFilename(response.headers["content-disposition"]),
  };
}

export async function createSunatDocumentsBulkPdfApi(
  requestDto: BulkPdfRequestDto,
): Promise<DownloadFileResult> {
  const response = await axiosAuth.post<Blob>(
    `${API.sunat}/api/v1/sunat-documents/bulk-pdf`,
    requestDto,
    {
      responseType: "blob",
    },
  );

  return {
    blob: response.data,
    filename: extractFilename(response.headers["content-disposition"]),
  };
}

export async function createSunatDocumentsBulkPdfZipApi(
  requestDto: BulkPdfRequestDto,
): Promise<DownloadFileResult> {
  const response = await axiosAuth.post<Blob>(
    `${API.sunat}/api/v1/sunat-documents/bulk-pdf-zip`,
    requestDto,
    {
      responseType: "blob",
    },
  );

  return {
    blob: response.data,
    filename: extractFilename(response.headers["content-disposition"]),
  };
}
