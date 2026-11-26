import { SUNAT_DOCUMENT_TYPES } from "../../sunat-document/enums/sunat-document.enums";
import type { SunatDocumentSequenceResponseDto } from "../dto/sunat-document-sequence-response.dto";

// Plain data builders with no MSW import, so unit tests (jsdom) and Storybook handlers share them

export const SUNAT_SEQUENCE_FIXTURE_COMPANY_ID = "company-001";
export const SUNAT_SEQUENCE_FIXTURE_RUC_ISSUER = "20616141971";

export function buildSunatDocumentSequenceResponse(
  overrides: Partial<SunatDocumentSequenceResponseDto> = {},
): SunatDocumentSequenceResponseDto {
  return {
    companyId: SUNAT_SEQUENCE_FIXTURE_COMPANY_ID,
    rucIssuer: SUNAT_SEQUENCE_FIXTURE_RUC_ISSUER,
    taxDocumentType: SUNAT_DOCUMENT_TYPES.INVOICE,
    series: "F001",
    nextCorrelative: 43,
    isDefault: true,
    ...overrides,
  };
}

/**
 * A realistic mixed state: Factura (F001) and Boleta (B001) configured and defaulted, Nota de
 * crédito (FC01) configured but NOT default (so "Marcar" has something to do). Nota de débito is
 * left out on purpose, so the "No configurado" empty state renders too.
 */
export function buildSunatDocumentSequenceList(): SunatDocumentSequenceResponseDto[] {
  return [
    buildSunatDocumentSequenceResponse(),
    buildSunatDocumentSequenceResponse({
      taxDocumentType: SUNAT_DOCUMENT_TYPES.SALES_RECEIPT,
      series: "B001",
      nextCorrelative: 118,
    }),
    buildSunatDocumentSequenceResponse({
      taxDocumentType: SUNAT_DOCUMENT_TYPES.CREDIT_NOTE,
      series: "FC01",
      nextCorrelative: 3,
      isDefault: false,
    }),
  ];
}
