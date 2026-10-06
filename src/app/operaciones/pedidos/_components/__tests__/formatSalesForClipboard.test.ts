import type { OrderHeader } from "@/interfaces/IOrder";
import { formatSalesForClipboard, mapOrderToSale } from "../types";

/**
 * Botón "Copiar" de Pedidos/Guías — el enlace de Google Maps del cliente
 * (customer.googleMapsUrl) viaja en el mapeo OrderHeader → Sale y se copia
 * dentro del bloque de su pedido.
 */
const LONG_URL =
  "https://www.google.com/maps/place/Av.+Javier+Prado+Este+123,+San+Isidro+15036/@-12.0912345,-77.0254321,17z/data=!3m1!4b1!4m6!3m5!1s0x9105c8f1!8m2!3d-12.09!4d-77.02?entry=ttu&g_ep=EgoyMDI2";

function makeOrder(n: number, googleMapsUrl?: string | null): OrderHeader {
  return {
    id: `o-${n}`,
    orderNumber: `PED-00${n}`,
    customer: {
      id: `c-${n}`,
      fullName: `Cliente ${n}`,
      phoneNumber: "999111222",
      district: "San Isidro",
      address: `Calle ${n}`,
      googleMapsUrl,
    },
    deliveryType: "DOMICILIO",
    grandTotal: "50.00",
    status: "PENDIENTE",
    salesRegion: "LIMA",
    items: [],
    payments: [],
    created_at: "2026-09-01T15:00:00.000Z",
    updated_at: "2026-09-01T15:00:00.000Z",
  } as unknown as OrderHeader;
}

const blocks = (text: string) => text.split("\n\n--------------------\n\n");

describe("mapOrderToSale — ubicación", () => {
  it("conserva customer.googleMapsUrl", () => {
    expect(mapOrderToSale(makeOrder(1, LONG_URL)).googleMapsUrl).toBe(LONG_URL);
    expect(mapOrderToSale(makeOrder(2)).googleMapsUrl).toBeNull();
  });
});

describe("formatSalesForClipboard — Google Maps", () => {
  it("un pedido con enlace: agrega la URL completa debajo de la dirección", () => {
    const text = formatSalesForClipboard([mapOrderToSale(makeOrder(1, LONG_URL))]);
    const lines = text.split("\n");

    expect(lines).toContain(`Google Maps: ${LONG_URL}`);
    expect(lines.indexOf(`Google Maps: ${LONG_URL}`)).toBe(lines.indexOf("Dirección: Calle 1") + 1);
    // El resto del formato no cambia.
    expect(lines[0]).toBe("Venta PED-001");
    expect(lines[lines.length - 1]).toMatch(/^Estado: /);
  });

  it("varios pedidos: cada enlace queda dentro del bloque de su pedido", () => {
    const text = formatSalesForClipboard([
      mapOrderToSale(makeOrder(1, "https://maps.app.goo.gl/uno")),
      mapOrderToSale(makeOrder(2)),
      mapOrderToSale(makeOrder(3, "https://maps.app.goo.gl/tres")),
    ]);
    const [b1, b2, b3] = blocks(text);

    expect(b1).toContain("Venta PED-001");
    expect(b1).toContain("Google Maps: https://maps.app.goo.gl/uno");
    expect(b2).toContain("Venta PED-002");
    expect(b2).not.toContain("Google Maps");
    expect(b3).toContain("Venta PED-003");
    expect(b3).toContain("Google Maps: https://maps.app.goo.gl/tres");
  });

  it.each([null, undefined, "", "   ", "no es un enlace", "javascript:alert(1)"])(
    "sin enlace válido (%p) omite la línea sin dejar 'undefined' ni 'null'",
    (value) => {
      const text = formatSalesForClipboard([mapOrderToSale(makeOrder(1, value))]);
      expect(text).not.toContain("Google Maps");
      expect(text).not.toMatch(/undefined|null/);
    },
  );
});
