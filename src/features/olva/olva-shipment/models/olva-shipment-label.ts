export interface OlvaShipmentLabel {
  filename: string;
  mimeType: string;
  /** The PDF, base64 encoded. See `olvaShipmentLabelToBlob`. */
  pdfBase64: string;
}
