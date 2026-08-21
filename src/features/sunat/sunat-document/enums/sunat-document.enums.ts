export const SUNAT_DOCUMENT_TYPES = {
  INVOICE: "01",
  SALES_RECEIPT: "03",
  CREDIT_NOTE: "07",
  DEBIT_NOTE: "08",
} as const;

export type SunatDocumentType = (typeof SUNAT_DOCUMENT_TYPES)[keyof typeof SUNAT_DOCUMENT_TYPES];

export const SUNAT_DOCUMENT_CDR_STATUSES = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  ACCEPTED_WITH_OBSERVATION: "ACCEPTED_WITH_OBSERVATION",
  REJECTED: "REJECTED",
  RETRY_EXCEEDED: "RETRY_EXCEEDED",
} as const;

export type SunatDocumentCdrStatus =
  (typeof SUNAT_DOCUMENT_CDR_STATUSES)[keyof typeof SUNAT_DOCUMENT_CDR_STATUSES];

export const IDENTITY_DOCUMENT_TYPES = {
  DNI: "1",
  CARNET_EXTRANJERIA: "4",
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

export type UnitCode = (typeof UNIT_CODES)[keyof typeof UNIT_CODES];

export const SUNAT_TAX_AFFECTATION_TYPES = {
  GRAVADO: "10",
  EXONERADO: "20",
  INAFECTO: "30",
  EXPORTACION: "40",
  GRATUITO: "21",
} as const;

export type SunatTaxAffectationType =
  (typeof SUNAT_TAX_AFFECTATION_TYPES)[keyof typeof SUNAT_TAX_AFFECTATION_TYPES];

export const CURRENCIES = {
  PEN: "PEN",
  USD: "USD",
} as const;

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const DEFAULT_SUNAT_DOCUMENT_SEQUENCES = [
  {
    taxDocumentType: SUNAT_DOCUMENT_TYPES.INVOICE,
    series: "F001",
  },
  {
    taxDocumentType: SUNAT_DOCUMENT_TYPES.SALES_RECEIPT,
    series: "B001",
  },
  {
    taxDocumentType: SUNAT_DOCUMENT_TYPES.CREDIT_NOTE,
    series: "FC01",
  },
  {
    taxDocumentType: SUNAT_DOCUMENT_TYPES.DEBIT_NOTE,
    series: "FD01",
  },
] as const;

export const SUNAT_DOCUMENT_TYPE_LABELS: Record<SunatDocumentType, string> = {
  [SUNAT_DOCUMENT_TYPES.INVOICE]: "Factura Electrónica",
  [SUNAT_DOCUMENT_TYPES.SALES_RECEIPT]: "Boleta de Venta Electrónica",
  [SUNAT_DOCUMENT_TYPES.CREDIT_NOTE]: "Nota de Crédito Electrónica",
  [SUNAT_DOCUMENT_TYPES.DEBIT_NOTE]: "Nota de Débito Electrónica",
};

export const SUNAT_DOCUMENT_TYPE_OPTIONS = Object.values(SUNAT_DOCUMENT_TYPES).map((value) => ({
  value,
  label: SUNAT_DOCUMENT_TYPE_LABELS[value],
}));
