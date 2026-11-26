import type { OlvaShipmentLabel } from "../models/olva-shipment-label";

/**
 * Decodes the base64 label into a Blob, ready for `URL.createObjectURL` (open in a tab, or an
 * `<a download>`). The caller owns the object URL and should `URL.revokeObjectURL` it.
 */
export function olvaShipmentLabelToBlob({ pdfBase64, mimeType }: OlvaShipmentLabel): Blob {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}
