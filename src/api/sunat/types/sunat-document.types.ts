export const DOCUMENT_TYPES = {
  FACTURA: "01",
  BOLETA: "03",
} as const;

export type DocumentType =
  (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const IDENTITY_DOCUMENT_TYPES = {
  DNI: "1",
  CARNET_EXTERIOR: "4",
  RUC: "6",
  PASAPORTE: "7",
} as const;

export type IdentityDocumentType =
  (typeof IDENTITY_DOCUMENT_TYPES)[keyof typeof IDENTITY_DOCUMENT_TYPES];

export const UNIT_CODES = {
  UNIT: "NIU",
  SERVICE: "ZZ",
  KILOGRAM: "KGM",
  LITER: "LTR",
} as const;

export type UnitCode =
  (typeof UNIT_CODES)[keyof typeof UNIT_CODES];

export const TAX_TYPES = {
  GRAVADO: "10",
  EXONERADO: "20",
  INAFECTO: "30",
  EXPORTACION: "40",
  GRATUITO: "21",
} as const;

export type TaxType =
  (typeof TAX_TYPES)[keyof typeof TAX_TYPES];

export const CURRENCIES = {
  PEN: "PEN",
  USD: "USD",
} as const;

export type Currency =
  (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const CDR_STATUSES = {
  ACCEPTED: "ACCEPTED",
  OBSERVED: "OBSERVED",
  REJECTED: "REJECTED",
  PENDING: "PENDING",
  RETRY_EXCEEDED: "RETRY_EXCEEDED",
} as const;

export type CdrStatus =
  (typeof CDR_STATUSES)[keyof typeof CDR_STATUSES];
  