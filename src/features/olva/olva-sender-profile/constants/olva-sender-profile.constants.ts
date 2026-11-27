// Mirrors ms-integrations: domain/sender-profiles/sender-profile.constants.ts

/** Active sender profiles one company may keep. Archived ones do not count. */
export const OLVA_MAX_SENDER_PROFILES_PER_COMPANY = 10;

/** Max length of the sender's first names and last name. */
export const OLVA_SENDER_NAME_MAX_LENGTH = 100;

/** The documents a sender can ship under (FEAT-35): a business by RUC, a person by DNI. */
export const OLVA_SENDER_DOCUMENT_TYPES = {
  DNI: "dni",
  RUC: "ruc",
} as const;

export type OlvaSenderDocumentType =
  (typeof OLVA_SENDER_DOCUMENT_TYPES)[keyof typeof OLVA_SENDER_DOCUMENT_TYPES];

/** A Peruvian RUC is always 11 digits. */
export const OLVA_RUC_LENGTH = 11;

/** A Peruvian DNI is always 8 digits. */
export const OLVA_DNI_LENGTH = 8;

/** How many digits each document has, to size the input. */
export const OLVA_SENDER_DOCUMENT_LENGTHS: Record<OlvaSenderDocumentType, number> = {
  [OLVA_SENDER_DOCUMENT_TYPES.DNI]: OLVA_DNI_LENGTH,
  [OLVA_SENDER_DOCUMENT_TYPES.RUC]: OLVA_RUC_LENGTH,
};

export const OLVA_SENDER_LABEL_MAX_LENGTH = 100;
export const OLVA_SENDER_EMAIL_MAX_LENGTH = 255;
export const OLVA_SENDER_PHONE_MIN_LENGTH = 6;
export const OLVA_SENDER_PHONE_MAX_LENGTH = 20;
