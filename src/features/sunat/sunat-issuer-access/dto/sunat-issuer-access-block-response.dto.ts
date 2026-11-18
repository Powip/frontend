import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export type SunatIssuerAccessBlockCategory = "CREDENTIALS" | "AUTHORIZATION";

export interface SunatIssuerAccessBlockResponseDto {
  sunatProfileId: string | null;
  rucIssuer: string;
  razonSocial: string | null;
  solUser: string | null;
  taxDocumentType: SunatDocumentType;
  category: SunatIssuerAccessBlockCategory;
  sunatCode: string | null;
  sunatMessage: string;
  blockedAt: string;
  lastFailedAt: string;
  heldDocuments: number;
}

export interface ReleaseSunatIssuerAccessBlockRequestDto {
  sunatProfileId: string;
  taxDocumentType: SunatDocumentType;
}

export interface ReleaseSunatIssuerAccessBlockResponseDto {
  released: boolean;
  resumedDocuments: number;
}
