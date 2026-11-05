import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";
import { buildBulkResult } from "../test-utils/send-to-olva.fixtures";
import { collectOlvaLabels } from "../utils/collect-olva-labels";
import { mergeOlvaLabelPdfs } from "../utils/merge-olva-label-pdfs";

// jsdom's Blob has no arrayBuffer()
const readBlobBytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const label = (name: string): OlvaShipmentLabel => ({
  filename: `${name}.pdf`,
  mimeType: "application/pdf",
  pdfBase64: name,
});

async function buildPdfLabel(pages: number): Promise<OlvaShipmentLabel> {
  const doc = await PDFDocument.create();

  for (let index = 0; index < pages; index += 1) doc.addPage([200, 300]);

  return {
    filename: "rotulo.pdf",
    mimeType: "application/pdf",
    pdfBase64: await doc.saveAsBase64(),
  };
}

describe("collectOlvaLabels", () => {
  it("uses the label that came with the answer and asks Olva only for the missing ones", async () => {
    const { results } = buildBulkResult([
      { key: "a", status: "created" },
      { key: "b", status: "created" },
      { key: "c", status: "failed" },
    ]);
    const withLabel = results.map((result, index) =>
      index === 1 && result.status === "created" ? { ...result, label: null } : result,
    );
    const fetchLabel = vi.fn().mockResolvedValue(label("fetched"));

    const collected = await collectOlvaLabels(withLabel, fetchLabel);

    expect(fetchLabel).toHaveBeenCalledTimes(1);
    expect(collected.labels).toHaveLength(2);
    expect(collected.missingItemKeys).toEqual([]);
  });

  it("keeps going when one label cannot be obtained, and says which order it was", async () => {
    const { results } = buildBulkResult([
      { key: "a", status: "created" },
      { key: "b", status: "created" },
    ]);
    const withoutLabels = results.map((result) =>
      result.status === "created" ? { ...result, label: null } : result,
    );
    const fetchLabel = vi
      .fn()
      .mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValueOnce(label("ok"));

    const collected = await collectOlvaLabels(withoutLabels, fetchLabel);

    expect(collected.labels).toHaveLength(1);
    expect(collected.missingItemKeys).toEqual(["a"]);
  });

  it("never asks for the label of an order that was not registered", async () => {
    const { results } = buildBulkResult([{ key: "a", status: "failed" }]);
    const fetchLabel = vi.fn();

    const collected = await collectOlvaLabels(results, fetchLabel);

    expect(fetchLabel).not.toHaveBeenCalled();
    expect(collected).toEqual({ labels: [], missingItemKeys: [] });
  });
});

describe("mergeOlvaLabelPdfs", () => {
  it("joins the pages of every label into one PDF, in order", async () => {
    const blob = await mergeOlvaLabelPdfs([await buildPdfLabel(1), await buildPdfLabel(2)]);
    const merged = await PDFDocument.load(await readBlobBytes(blob));

    expect(blob.type).toBe("application/pdf");
    expect(merged.getPageCount()).toBe(3);
  });
});
