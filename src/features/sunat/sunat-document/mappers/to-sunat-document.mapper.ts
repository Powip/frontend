import type { SunatDocumentResponseDto } from "../dto/sunat-documents-response.dto";
import type { SunatDocument } from "../models/sunat-document.model";

export function toSunatDocument(dto: SunatDocumentResponseDto): SunatDocument {
  return {
    id: dto.id,
    orderId: dto.orderId,
    companyId: dto.companyId,
    rucIssuer: dto.rucIssuer,

    taxDocumentType: dto.taxDocumentType,
    series: dto.series,
    correlative: dto.correlative,
    issueDate: dto.issueDate,

    cdrStatus: dto.cdrStatus,

    sunatCode: dto.sunatCode,
    sunatDescription: dto.sunatDescription,
    observations: dto.observations,

    signedXmlStoragePath: dto.signedXmlStoragePath,
    cdrStoragePath: dto.cdrStoragePath,
    digestValue: dto.digestValue,

    taxDocumentPayload: dto.taxDocumentPayload,

    referenceDocumentId: dto.referenceDocumentId,

    voidStatus: dto.voidStatus ?? null,
    voidReason: dto.voidReason ?? null,
    voidRequestedAt: dto.voidRequestedAt ?? null,
    voidTicket: dto.voidTicket ?? null,
    voidSunatCode: dto.voidSunatCode ?? null,
    voidSunatDescription: dto.voidSunatDescription ?? null,
    voidedAt: dto.voidedAt ?? null,
    voidDeadline: dto.voidDeadline ?? "",
    voidable: dto.voidable === true,

    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
