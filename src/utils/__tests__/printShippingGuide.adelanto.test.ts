import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { printShippingGuide } from "../printShippingGuide";

jest.mock("../printOrderLabel", () => ({ generateBarcode: () => "" }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const guide = { guideNumber: "GE-001", courierName: "Shalom", deliveryZones: [], status: "APROBADA" as const, created_at: "2026-11-12T23:11:37Z" };

const order = (orderNumber: string, grandTotal: number, payments: OrderDetail["payments"]): OrderDetail => ({
  id: orderNumber, orderId: orderNumber, orderNumber, status: "EN_ENVIO", grandTotal,
  customer: { fullName: "Cliente", phoneNumber: "999999999", address: "Dirección" },
  payments,
  items: [{ productName: "Producto", sku: "P", quantity: 1, unitPrice: grandTotal, trackingMode: "NONE" }],
} as unknown as OrderDetail);

function printed(orders: OrderDetail[]) {
  const written: string[] = [];
  const win = { document: { write: jest.fn((html: string) => { written.push(html); return written.length; }), close: jest.fn() },
    focus: jest.fn(), print: jest.fn(), close: jest.fn(), closed: false, onload: null as null | (() => void) };
  jest.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  const done = printShippingGuide(guide, orders);
  const doc = new DOMParser().parseFromString(written.join(""), "text/html");
  return { doc, finish: async () => { win.onload?.(); await done; } };
}
const rowOf = (doc: Document, orderNumber: string) =>
  [...doc.querySelectorAll("tbody tr")].find((row) => row.textContent?.includes(orderNumber));

afterEach(() => jest.restoreAllMocks());

describe("guía de salida: adelantos por aprobar", () => {
  it("avisa en la fila del pedido sin restar el adelanto del monto a cobrar", async () => {
    const p = printed([order("ORD-1", 179, [{ amount: 20, status: "PENDING" }])]);
    const row = rowOf(p.doc, "ORD-1");

    expect(row?.querySelector(".cobrar-cod")?.textContent).toBe("S/ 179.00");
    expect(row?.textContent).toContain("Adelanto S/ 20.00 por aprobar");
    await p.finish();
  });

  it("el resumen suma los adelantos por aprobar y cuenta los pedidos afectados", async () => {
    const p = printed([
      order("ORD-1", 179, [{ amount: 20, status: "PENDING" }]),
      order("ORD-2", 279, [{ amount: 20, status: "PENDING" }]),
      order("ORD-3", 100, [{ amount: 100, status: "PAID" }]),
    ]);
    const line = [...p.doc.querySelectorAll(".tline")].find((l) => l.textContent?.includes("Adelantos por aprobar"));

    expect(line?.textContent).toContain("S/ 40.00");
    expect(line?.textContent).toContain("2 pedidos");
    expect(p.doc.querySelector(".tline.total")?.textContent).toContain("S/ 458.00");
    await p.finish();
  });

  it("el adelanto aprobado sigue restando y no genera aviso", async () => {
    const p = printed([order("ORD-1", 179, [{ amount: 20, status: "PAID" }])]);

    expect(rowOf(p.doc, "ORD-1")?.querySelector(".cobrar-cod")?.textContent).toBe("S/ 159.00");
    expect(p.doc.body.textContent).not.toContain("por aprobar");
    await p.finish();
  });

  it("no avisa cuando el pedido ya está pagado por completo aunque quede un pago pendiente", async () => {
    const p = printed([order("ORD-1", 100, [{ amount: 100, status: "PAID" }, { amount: 20, status: "PENDING" }])]);

    expect(rowOf(p.doc, "ORD-1")?.textContent).toContain("PREPAGO");
    expect(p.doc.body.textContent).not.toContain("por aprobar");
    await p.finish();
  });

  it("usa singular cuando solo hay un pedido con adelanto por aprobar", async () => {
    const p = printed([order("ORD-1", 179, [{ amount: 20, status: "PENDING" }])]);
    const line = [...p.doc.querySelectorAll(".tline")].find((l) => l.textContent?.includes("Adelantos por aprobar"));

    expect(line?.textContent).toContain("1 pedido");
    expect(line?.textContent).not.toContain("1 pedidos");
    await p.finish();
  });
});
