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
const notSaved = (itemKey: string): OlvaBulkShipmentResult => ({
  status: "registered_not_saved",
  itemKey,
  label: null,
  registeredInOlva: {} as never,
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
      registeredNotSaved,
      failed: f,
    } = splitOlvaBulkResults([failed("1", "X"), created("2"), notSaved("3"), created("4")]);

    expect(c.map((r) => r.itemKey)).toEqual(["2", "4"]);
    expect(registeredNotSaved.map((r) => r.itemKey)).toEqual(["3"]);
    expect(f.map((r) => r.itemKey)).toEqual(["1"]);
  });

  it("only failed items whose order is free can be resent; never created or not-saved", () => {
    const items = ["A", "B", "C", "D"].map((key) => buildBulkOlvaShipmentItemInput(key));

    const retryable = getRetryableOlvaBulkItems(items, [
      created("A"),
      notSaved("B"),
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
    [
      { total: 3, created: 3, registeredNotSaved: 0, failed: 0 },
      "success",
      "3 envíos creados correctamente.",
    ],
    [
      { total: 1, created: 1, registeredNotSaved: 0, failed: 0 },
      "success",
      "1 envío creado correctamente.",
    ],
    [
      { total: 3, created: 2, registeredNotSaved: 0, failed: 1 },
      "warning",
      "2 de 3 envíos creados. 1 falló: corrígelos y reenvíalos.",
    ],
    [
      { total: 2, created: 0, registeredNotSaved: 0, failed: 2 },
      "error",
      "No se pudo crear ningún envío. Revisa los errores e intenta de nuevo.",
    ],
    [
      { total: 2, created: 1, registeredNotSaved: 1, failed: 0 },
      "error",
      "1 envío se registró en Olva pero no se pudo guardar. No los envíes de nuevo: contacta a soporte.",
    ],
  ])("summarizes %j", (summary, tone, message) => {
    expect(getOlvaBulkSummaryMessage(summary)).toEqual({ tone, message });
  });
});
