import type { Order } from "@/features/sales/models/order";
import { buildSunatDocumentFromSale } from "../build-sunat-document-from-sale";

type SaleItem = { sku: string; quantity: number; unitPrice: number; discountAmount?: number };

/**
 * Venta mínima como la guarda Powip. Los precios de Shopify llevan IGV
 * incluido (taxMode INCLUIDO), igual que el importador de ms-ventas.
 */
function sale(params: {
  items: SaleItem[];
  shippingTotal?: number;
  discountTotal?: number;
  taxMode?: "INCLUIDO" | "AUTOMATICO";
}): Order {
  return {
    id: "order-1",
    taxMode: params.taxMode ?? "INCLUIDO",
    shippingTotal: params.shippingTotal ?? 0,
    discountTotal: params.discountTotal ?? 0,
    customer: {
      fullName: "Cliente Prueba",
      documentType: "DNI",
      documentNumber: "12345678",
      address: "Av. Siempre Viva 123",
    },
    items: params.items.map((item, index) => ({
      id: `item-${index}`,
      productName: `Producto ${index + 1}`,
      discountAmount: 0,
      ...item,
    })),
  } as unknown as Order;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Total del comprobante tal como lo ve el cliente: importe sin IGV de cada
 * línea (cantidad × precio − descuento) más el IGV de las líneas gravadas.
 */
function grandTotalOf(sale: Order): number {
  return buildSunatDocumentFromSale(sale).totals.grandTotal;
}

describe("buildSunatDocumentFromSale — descuentos", () => {
  it("ORD-155969 (Shopify, código BIENVENIDA5 repartido por línea + envío): el comprobante cuadra con S/ 209.65, no con S/ 220", () => {
    const order = sale({
      items: [
        { sku: "SG-MUAA-BALS-5GR", quantity: 1, unitPrice: 27, discountAmount: 1.35 },
        { sku: "SG-PARI-A-120ML", quantity: 1, unitPrice: 37, discountAmount: 1.85 },
        { sku: "SG-MARR-CO-10ML", quantity: 1, unitPrice: 55, discountAmount: 2.75 },
        { sku: "SG-MAGN-POL-300GR", quantity: 1, unitPrice: 88, discountAmount: 4.4 },
      ],
      shippingTotal: 13,
      discountTotal: 10.35,
    });

    const document = buildSunatDocumentFromSale(order);

    expect(document.totals.grandTotal).toBe(209.65);
    expect(round2(document.totals.subtotal + document.totals.taxTotal)).toBe(209.65);
    // 4 productos + el envío
    expect(document.items).toHaveLength(5);
    expect(document.items.slice(0, 4).every((item) => item.discountAmount > 0)).toBe(true);
    // El envío no tiene descuento propio.
    expect(document.items[4]).toMatchObject({ sku: "DELIVERY", discountAmount: 0 });
  });

  it("sin descuentos no cambia nada: productos + envío", () => {
    const order = sale({
      items: [
        { sku: "A", quantity: 1, unitPrice: 100 },
        { sku: "B", quantity: 2, unitPrice: 53.5 },
      ],
      shippingTotal: 13,
    });

    expect(grandTotalOf(order)).toBe(220);
    expect(buildSunatDocumentFromSale(order).items.every((item) => item.discountAmount === 0)).toBe(
      true,
    );
  });

  it("descuento por línea (porcentaje sobre un solo producto)", () => {
    const order = sale({
      items: [
        { sku: "A", quantity: 2, unitPrice: 100, discountAmount: 40 },
        { sku: "B", quantity: 1, unitPrice: 50 },
      ],
      discountTotal: 40,
    });

    expect(grandTotalOf(order)).toBe(210);
  });

  it("descuento automático / de pedido ya repartido por línea suma igual que el total de la cabecera", () => {
    const order = sale({
      items: [
        { sku: "A", quantity: 1, unitPrice: 60, discountAmount: 6 },
        { sku: "B", quantity: 1, unitPrice: 40, discountAmount: 4 },
      ],
      shippingTotal: 10,
      discountTotal: 10,
    });

    expect(grandTotalOf(order)).toBe(100);
  });

  it("envío gratis: el descuento está solo en la cabecera y va a la línea de envío", () => {
    // Shopify: total_shipping_price_set 13, total_discounts 13, total_price 100.
    const order = sale({
      items: [{ sku: "A", quantity: 1, unitPrice: 100 }],
      shippingTotal: 13,
      discountTotal: 13,
    });

    const document = buildSunatDocumentFromSale(order);

    expect(document.totals.grandTotal).toBe(100);
    const delivery = document.items.find((item) => item.sku === "DELIVERY");
    expect(delivery).toBeDefined();
    // El envío queda en cero: el importe sin IGV menos el descuento sin IGV.
    expect(round2(delivery!.subtotal - delivery!.discountAmount)).toBe(0);
    // Los productos conservan su precio completo.
    expect(document.items[0].discountAmount).toBe(0);
  });

  it("descuento de pedido sin asignar a líneas se reparte entre los productos y el total cuadra", () => {
    const order = sale({
      items: [
        { sku: "A", quantity: 1, unitPrice: 120 },
        { sku: "B", quantity: 1, unitPrice: 80 },
      ],
      discountTotal: 20,
    });

    const document = buildSunatDocumentFromSale(order);

    expect(document.totals.grandTotal).toBe(180);
    // Proporcional: 12 y 8 (con IGV), convertidos a neto.
    expect(round2(document.items[0].discountAmount * 1.18)).toBe(12);
    expect(round2(document.items[1].discountAmount * 1.18)).toBe(8);
  });

  it("mezcla: descuento por línea + envío gratis + descuento de pedido sobrante", () => {
    // Productos 200, descuento en línea 10, envío 15 (gratis) y 20 de descuento
    // de pedido que Shopify no repartió: 15 al envío, 5 a los productos.
    const order = sale({
      items: [
        { sku: "A", quantity: 1, unitPrice: 120, discountAmount: 10 },
        { sku: "B", quantity: 1, unitPrice: 80 },
      ],
      shippingTotal: 15,
      discountTotal: 10 + 15 + 5,
    });

    expect(grandTotalOf(order)).toBe(round2(200 + 15 - 30));
  });

  it("no pierde centavos al repartir en partes que no son exactas", () => {
    const order = sale({
      items: [
        { sku: "A", quantity: 1, unitPrice: 33.33 },
        { sku: "B", quantity: 1, unitPrice: 33.33 },
        { sku: "C", quantity: 1, unitPrice: 33.34 },
      ],
      discountTotal: 10,
    });

    expect(grandTotalOf(order)).toBe(90);
  });

  it("un descuento mayor al importe de la línea no la deja en negativo", () => {
    const order = sale({
      items: [{ sku: "A", quantity: 1, unitPrice: 50, discountAmount: 80 }],
      discountTotal: 80,
    });

    const document = buildSunatDocumentFromSale(order);

    expect(document.totals.grandTotal).toBe(0);
    expect(document.items[0].discountAmount).toBeLessThanOrEqual(
      document.items[0].subtotal + 0.0001,
    );
  });

  it("precios sin IGV incluido (AUTOMATICO): el descuento pasa tal cual", () => {
    const order = sale({
      items: [{ sku: "A", quantity: 1, unitPrice: 100, discountAmount: 10 }],
      discountTotal: 10,
      taxMode: "AUTOMATICO",
    });

    const document = buildSunatDocumentFromSale(order);

    expect(document.items[0].discountAmount).toBe(10);
    expect(document.totals.subtotal).toBe(90);
    expect(document.totals.taxTotal).toBe(16.2);
    expect(document.totals.grandTotal).toBe(106.2);
  });
});
