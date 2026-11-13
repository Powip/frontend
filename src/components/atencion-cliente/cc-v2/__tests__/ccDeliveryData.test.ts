import type { OrderDeliverySnapshot } from "@/interfaces/IOrder";
import { hasCompleteDeliveryLocation, isJunkLocationValue } from "../ccDeliveryData";

const customer = {
  province: "Lima",
  city: "Lima",
  district: "Miraflores",
  address: "Av. Flores 123",
};

const snapshot = (overrides: Partial<OrderDeliverySnapshot> = {}): OrderDeliverySnapshot => ({
  version: 1,
  type: "HOME",
  department: "Lima",
  province: "Lima",
  district: "Surco",
  address: "Av. Caminos del Inca 100",
  agency: null,
  reference: null,
  latitude: null,
  longitude: null,
  googleMapsUrl: null,
  zone: null,
  ...overrides,
});

describe("isJunkLocationValue", () => {
  it.each([undefined, null, "", "   ", "POR COMPLETAR", "por completar", " - ", "0", "S/D", "N/A", "LIMA_NORTE", "provincias"])(
    "%p es un valor basura",
    (value) => expect(isJunkLocationValue(value)).toBe(true),
  );

  it.each(["Lima", "Av. Flores 123", "Miraflores"])("%p es un dato real", (value) =>
    expect(isJunkLocationValue(value)).toBe(false),
  );
});

/**
 * Misma regla que el backend (`hasCompleteCcCustomerData`, cc-customer-data.ts) SIN contar el DNI:
 * con `deliverySnapshot` la dirección sale de ahí (`department` hace de `city`); si no, del cliente.
 * Sirve para dejar aceptar una venta sin DNI (el DNI se pide al despachar) sin aflojar la dirección.
 */
describe("hasCompleteDeliveryLocation", () => {
  it("true cuando departamento, provincia, distrito y dirección son reales", () => {
    expect(hasCompleteDeliveryLocation({ customer })).toBe(true);
  });

  it.each(["province", "city", "district", "address"] as const)(
    "false si falta %s del cliente",
    (field) => {
      expect(hasCompleteDeliveryLocation({ customer: { ...customer, [field]: "" } })).toBe(false);
    },
  );

  it("false si algún campo es un valor basura del sistema de origen", () => {
    expect(hasCompleteDeliveryLocation({ customer: { ...customer, address: "POR COMPLETAR" } })).toBe(false);
    expect(hasCompleteDeliveryLocation({ customer: { ...customer, city: "LIMA_NORTE" } })).toBe(false);
  });

  it("con deliverySnapshot manda el snapshot, no el cliente (los pedidos Shopify COD se corrigen ahí)", () => {
    const junkCustomer = { province: "", city: "", district: "", address: "" };
    expect(hasCompleteDeliveryLocation({ customer: junkCustomer, deliverySnapshot: snapshot() })).toBe(true);
    expect(
      hasCompleteDeliveryLocation({ customer, deliverySnapshot: snapshot({ address: "POR COMPLETAR" }) }),
    ).toBe(false);
  });

  it("con snapshot, el departamento del snapshot ocupa el lugar de city", () => {
    expect(hasCompleteDeliveryLocation({ customer, deliverySnapshot: snapshot({ department: "" }) })).toBe(false);
  });

  it("sin cliente (y sin snapshot) coincide con el backend: completo", () => {
    expect(hasCompleteDeliveryLocation({ customer: null })).toBe(true);
  });

  it("sin pedido cargado todavía: false", () => {
    expect(hasCompleteDeliveryLocation(null)).toBe(false);
    expect(hasCompleteDeliveryLocation(undefined)).toBe(false);
  });
});
