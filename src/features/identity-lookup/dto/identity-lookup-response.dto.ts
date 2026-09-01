import type { IdentityLookupDocumentType } from "../enums/identity-lookup.enums";

export interface IdentityLookupResponseDto {
  documentType: IdentityLookupDocumentType;
  documentNumber: string;

  fullName: string;
  tradeName: string | null;
  status: string | null;
  condition: string | null;
  address: string | null;
  ubigeo: string | null;
  district: string | null;
  province: string | null;
  department: string | null;

  fetchedAt: string;
}
