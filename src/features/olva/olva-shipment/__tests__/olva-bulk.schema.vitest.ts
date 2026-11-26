import { describe, expect, it } from "vitest";
import { bulkCreateOlvaShipmentsSchema } from "../schemas/olva-bulk-shipments.schema";

const item = (itemKey: string, orderId?: string) => ({
  itemKey,
  recipient: { documentType: "dni", documentNumber: "12345678", fullName: "Juan", phone: "999" },
  origin: { headquarterId: "12" },
  destination: { agencyCode: "LIM01" },
  package: { weightKg: "1", declaredValue: "50" },
  whoPays: "STORE",
  externalRef: orderId ? { orderId } : undefined,
});

const issuesOf = (input: unknown) =>
  bulkCreateOlvaShipmentsSchema.safeParse(input).error?.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  })) ?? [];

describe("bulkCreateOlvaShipmentsSchema", () => {
  it("accepts a valid lot", () => {
    const { success, data } = bulkCreateOlvaShipmentsSchema.safeParse({
      items: [item("A", "PED-1"), item("B", "PED-2")],
    });

    expect(success).toBe(true);
    expect(data?.items[0].package.declaredValue).toBe(50);
  });

  it("needs 1 to 25 items", () => {
    expect(issuesOf({ items: [] })[0].message).toBe("Agrega al menos un envío");

    const many = Array.from({ length: 26 }, (_, i) => item(`K${i}`));

    expect(issuesOf({ items: many })[0].message).toBe("Un lote admite hasta 25 envíos");
  });

  it("rejects a repeated item key and a repeated order, pointing at the second one", () => {
    expect(issuesOf({ items: [item("A", "P1"), item("A", "P2")] })).toEqual([
      { path: "items.1.itemKey", message: "La clave del envío está repetida en el lote" },
    ]);
    expect(issuesOf({ items: [item("A", "P1"), item("B", "P1")] })).toEqual([
      { path: "items.1.externalRef.orderId", message: "El pedido está repetido en el lote" },
    ]);
  });

  it("applies the per-shipment rules to each item, with the item index in the path", () => {
    const bad = { ...item("B"), whoPays: "ONLINE" };

    expect(issuesOf({ items: [item("A"), bad] })).toEqual([
      { path: "items.1.paymentMethod", message: "Elige un método de pago" },
    ]);
  });

  it("accepts a home delivery in a lot and points its issues at the item", () => {
    const home = (itemKey: string, destination: object) => ({
      ...item(itemKey, `P-${itemKey}`),
      deliveryType: "D",
      whoPays: "ONLINE",
      paymentMethod: "niubiz",
      destination,
    });
    const place = { ubigeoCode: "250202", address: "Av. 1", reference: "Parque" };

    const ok = bulkCreateOlvaShipmentsSchema.safeParse({ items: [home("A", place)] });

    expect(ok.success).toBe(true);
    expect(ok.data?.items[0].destination).toEqual(place);
    expect(
      issuesOf({ items: [item("A", "P1"), home("B", { ...place, ubigeoCode: "1" })] }),
    ).toEqual([
      {
        path: "items.1.destination.ubigeoCode",
        message: "El ubigeo debe tener exactamente 6 dígitos",
      },
    ]);
  });
});
