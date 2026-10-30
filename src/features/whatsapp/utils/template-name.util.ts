export const TEMPLATE_TECHNICAL_NAME_MAX_LENGTH = 512;

export function toTemplateTechnicalName(displayName: string): string {
  return displayName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, TEMPLATE_TECHNICAL_NAME_MAX_LENGTH)
    .replace(/_+$/g, "");
}
