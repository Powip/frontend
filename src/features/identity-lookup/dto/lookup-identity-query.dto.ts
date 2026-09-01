import type { IdentityLookupDocumentType } from "../enums/identity-lookup.enums";

export interface LookupIdentityQueryDto {
  documentType: IdentityLookupDocumentType;
  documentNumber: string;
}
