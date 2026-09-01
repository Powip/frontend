/**
 * Mirrors the backend's lookupIdentityQuerySchema format rules (8-digit
 * DNI, 11-digit RUC). Kept here purely as a UX nicety - to disable the
 * verify button and avoid a wasted round trip before the user has typed a
 * plausible number - not as the source of truth for validity. The backend
 * remains the actual authority and will reject anything that slips past
 * this check anyway.
 */
const DNI_PATTERN = /^\d{8}$/;
const RUC_PATTERN = /^\d{11}$/;

export function isValidDniFormat(documentNumber: string): boolean {
  return DNI_PATTERN.test(documentNumber);
}

export function isValidRucFormat(documentNumber: string): boolean {
  return RUC_PATTERN.test(documentNumber);
}
