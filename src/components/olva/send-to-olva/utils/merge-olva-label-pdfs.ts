import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

/**
 * One PDF with every label, in order. Each label keeps its own page size, so Olva's layout is not
 * altered. `pdf-lib` is loaded only when this runs, to keep it out of the main bundle.
 */
export async function mergeOlvaLabelPdfs(labels: readonly OlvaShipmentLabel[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();

  for (const label of labels) {
    const source = await PDFDocument.load(base64ToBytes(label.pdfBase64));
    const pages = await merged.copyPages(source, source.getPageIndices());

    for (const page of pages) merged.addPage(page);
  }

  return new Blob([new Uint8Array(await merged.save())], { type: "application/pdf" });
}
