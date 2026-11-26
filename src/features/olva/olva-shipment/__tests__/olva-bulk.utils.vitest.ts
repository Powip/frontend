import { describe, expect, it } from "vitest";
import type { OlvaBulkShipmentResult } from "../models/olva-bulk-shipment-result";
import {
  buildBulkOlvaShipmentItemInput,
  buildCreateOlvaShipmentInput,
} from "../test-utils/olva-shipment.fixtures";
import { chunkOlvaBulkShipmentItems } from "../utils/chunk-olva-bulk-shipment-items";
import { getOlvaBulkSummaryMessage } from "../utils/get-olva-bulk-summary-message";
import { getRetryableOlvaBulkItems } from "../utils/get-retryable-olva-bulk-items";
import { splitOlvaBulkResults } from "../utils/split-olva-bulk-results";
import { toOlvaBulkItems } from "../utils/to-olva-bulk-items";

const created = (itemKey: string): OlvaBulkShipmentResult => ({
  status: "created",
  itemKey,
  label: null,
  shipment: {} as never,
});
const unknown = (itemKey: string): OlvaBulkShipmentResult => ({
  status: "unknown",
  itemKey,
  shipment: {} as never,
  error: { code: "OLVA_OUTCOME_UNKNOWN", message: "x" },
});
const failed = (itemKey: string, code: string): OlvaBulkShipmentResult => ({
  status: "failed",
  itemKey,
  error: { code, message: "x" },
  existingShipment: null,
});

describe("olva bulk utils", () => {
  it("splits results by status keeping order", () => {
    const {
      created: c,
      unknown: u,
      failed: f,
    } = splitOlvaBulkResults([failed("1", "X"), created("2"), unknown("3"), created("4")]);

    expect(c.map((r) => r.itemKey)).toEqual(["2", "4"]);
    expect(u.map((r) => r.itemKey)).toEqual(["3"]);
    expect(f.map((r) => r.itemKey)).toEqual(["1"]);
  });

  it("only failed items whose order is free can be resent; never created or unknown", () => {
    const items = ["A", "B", "C", "D"].map((key) => buildBulkOlvaShipmentItemInput(key));

    const retryable = getRetryableOlvaBulkItems(items, [
      created("A"),
      unknown("B"),
      failed("C", "SHIPMENT_ALREADY_EXISTS"),
      failed("D", "SHIPMENT_ORIGIN_DOES_NOT_ACCEPT_PAYMENT"),
    ]);

    expect(retryable.map((item) => item.itemKey)).toEqual(["D"]);
  });

  it("chunks into lots of at most 25 and never more, whatever the size asked", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);

    expect(chunkOlvaBulkShipmentItems(items).map((chunk) => chunk.length)).toEqual([25, 25, 10]);
    expect(chunkOlvaBulkShipmentItems(items, 100)[0]).toHaveLength(25);
    expect(chunkOlvaBulkShipmentItems(items, 0)[0]).toHaveLength(1);
    expect(chunkOlvaBulkShipmentItems([])).toEqual([]);
  });

  it("keys items by order id, falling back to the position for repeats and missing orders", () => {
    const withOrder = (orderId?: string) =>
      buildCreateOlvaShipmentInput({ externalRef: orderId ? { orderId } : undefined });

    expect(
      toOlvaBulkItems([
        withOrder("PED-1"),
        withOrder("PED-1"),
        withOrder(),
        withOrder("PED-2"),
      ]).map((item) => item.itemKey),
    ).toEqual(["PED-1", "item-2", "item-3", "PED-2"]);
  });

  it.each([
    [{ total: 3, created: 3, unknown: 0, failed: 0 }, "success", "3 envíos creados correctamente."],
    [{ total: 1, created: 1, unknown: 0, failed: 0 }, "success", "1 envío creado correctamente."],
    [
      { total: 3, created: 2, unknown: 0, failed: 1 },
      "warning",
      "2 de 3 envíos creados. 1 falló: corrígelos y reenvíalos.",
    ],
    [
      { total: 2, created: 0, unknown: 0, failed: 2 },
      "error",
      "No se pudo crear ningún envío. Revisa los errores e intenta de nuevo.",
    ],
    [
      { total: 2, created: 1, unknown: 1, failed: 0 },
      "warning",
      "1 envío se está verificando con Olva: no lo registres de nuevo. Se confirma solo o con «Reintentar».",
    ],
    [
      { total: 3, created: 0, unknown: 2, failed: 1 },
      "warning",
      "2 envíos se están verificando con Olva: no los registres de nuevo. Se confirman solos o con «Reintentar».",
    ],
  ])("summarizes %j", (summary, tone, message) => {
    expect(getOlvaBulkSummaryMessage(summary)).toEqual({ tone, message });
  });
});
