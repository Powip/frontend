import { SEND_TO_OLVA_DESCRIPTION_MAX_LENGTH } from "../constants/send-to-olva.constants";

/** "2x Polo, 1x Gorra": what the package holds, cut to what the form accepts. */
export function buildOlvaPackageDescription(
  items: readonly { quantity: number; productName: string }[] | null | undefined,
): string {
  const text = (items ?? [])
    .map(({ quantity, productName }) => `${quantity}x ${productName}`)
    .join(", ");

  return text.length > SEND_TO_OLVA_DESCRIPTION_MAX_LENGTH
    ? `${text.slice(0, SEND_TO_OLVA_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
    : text;
}
