import type { CountryCode } from "../../shared/enums/sunat.enums";
import type {
  Currency,
  IdentityDocumentType,
  SunatDocumentCdrStatus,
  SunatDocumentType,
  SunatTaxAffectationType,
  UnitCode,
} from "../enums/sunat-document.enums";

export interface SunatDocumentCustomer {
  name?: string;
  identityDocumentType?: IdentityDocumentType;
  identityDocumentNumber?: string;
  countryCode?: CountryCode;
  address?: string;
}

export interface SunatDocumentItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  unitCode: UnitCode;
  taxType: SunatTaxAffectationType;
}

export interface SunatDocumentTotals {
  currency: Currency;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface SunatDocumentPayload {
  customer?: SunatDocumentCustomer;
  totals: SunatDocumentTotals;
  items: SunatDocumentItem[];
}

export interface SunatDocument {
  id: string;
  orderId: string;
  companyId: string;
  rucIssuer: string;
  taxDocumentType: SunatDocumentType;
  series: string;
  correlative: string;
  issueDate: string;
  cdrStatus: SunatDocumentCdrStatus;
  sunatCode: string | null;
  sunatDescription: string | null;
  observations: string | null;
  signedXmlStoragePath: string | null;
  cdrStoragePath: string | null;
  digestValue: string | null;
  taxDocumentPayload: SunatDocumentPayload;
  referenceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}
