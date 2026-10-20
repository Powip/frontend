import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { printShippingGuide } from "../printShippingGuide";

jest.mock("../printOrderLabel", () => ({ generateBarcode: () => "" }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const guide = { guideNumber: "G-001", courierName: "Local", deliveryZones: [], status: "CREADA" as const, created_at: "2026-10-17T12:00:00Z" };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const longCode = "0" + "X".repeat(99);
const order = (): OrderDetail => ({
  id: "order-1", orderId: "order-1", orderNumber: "PED-001", status: "EN_ENVIO", grandTotal: 100,
  customer: { fullName: "Cliente", phoneNumber: "999999999", address: "Dirección" },
  payments: [{ amount: 20, status: "PAID" }, { amount: 10, status: "PENDING_APPROVAL" }],
  unitCatalogValidated: true, unitAssignmentStatus: "CONFIRMED", stockVersion: 2, confirmedStockVersion: 2,
  items: [{ productName: "Equipo", sku: "E", quantity: 2, unitPrice: 40, trackingMode: "SERIAL", unitIds: [id(1), id(2)],
    units: [{ id: id(1), code: longCode, status: "RESERVED" }, { id: id(2), code: "SERIE-2", status: "RESERVED" }] },
    { productName: "Accesorio", sku: "A", quantity: 1, unitPrice: 20, trackingMode: "NONE" }],
});
function windowFixture() {
  const written: string[] = [];
  const win = { document: { write: jest.fn((html: string) => written.push(html)), close: jest.fn() },
    focus: jest.fn(), print: jest.fn(), close: jest.fn(), closed: false, onload: null as null | (() => void) };
  win.document.write.mockImplementation((html: string) => { win.onload = null; written.push(html); return written.length; });
  jest.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  return { win, written, document: () => new DOMParser().parseFromString(written.join(""), "text/html") };
}
afterEach(() => jest.restoreAllMocks());

describe("printShippingGuide: códigos confirmados y alcance de impresión", () => {
  it("conserva todas las series largas por producto y todos los pedidos sin cambiar el saldo", async () => {
    const popup = windowFixture();
    const normal = { ...order(), id: "order-2", orderNumber: "PED-002", items: [order().items[1]], payments: [{ amount: 100, status: "PAID" }] };
    const done = printShippingGuide(guide, [order(), normal]);
    const doc = popup.document();
    const rows = [...doc.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(2);
    expect([...doc.querySelectorAll(".unit-code")].map(node => node.textContent)).toEqual([`Serie: ${longCode}`, "Serie: SERIE-2"]);
    expect(rows.find(row => row.textContent?.includes("PED-001"))?.textContent).toContain("S/ 70.00");
    expect(rows.find(row => row.textContent?.includes("PED-002"))?.querySelector(".unit-codes")).toBeNull();
    expect(doc.body.textContent).toContain("Accesorio");
    expect(popup.written[0]).toContain("overflow-wrap:anywhere");
    const printStyles = doc.querySelector("style")?.textContent;
    expect(printStyles).toContain(".section, tbody, tbody tr{break-inside:auto;page-break-inside:auto;}");
    expect(printStyles).toContain(".sec-h{break-after:avoid;page-break-after:avoid;}");
    expect(printStyles).toContain("thead{display:table-header-group;break-after:avoid;page-break-after:avoid;}");
    expect(printStyles).toContain(".unit-code{break-inside:avoid;page-break-inside:avoid;}");
    expect(doc.body.textContent).not.toContain("Página 1 de 1");
    expect(popup.win.print).not.toHaveBeenCalled();
    popup.win.onload?.(); await done;
    expect(popup.win.print).toHaveBeenCalledTimes(1);
  });
  it.each(["PENDING", "REJECTED"])("no muestra códigos cuando la asignación está %s", async (status) => {
    const popup = windowFixture();
    const done = printShippingGuide(guide, [{ ...order(), unitAssignmentStatus: status }]);
    expect(popup.document().querySelector(".unit-code")).toBeNull();
    expect(popup.document().body.textContent).toContain("Códigos pendientes de confirmación");
    popup.win.onload?.(); await done;
  });
  it("no muestra snapshots de otra versión", async () => {
    const popup = windowFixture();
    const done = printShippingGuide(guide, [{ ...order(), stockVersion: 3 }]);
    expect(popup.written[0]).not.toContain(longCode);
    popup.win.onload?.(); await done;
  });
  it("escapa texto de producto, cliente, empresa y guía sin permitir HTML ejecutable", async () => {
    const popup = windowFixture(), data = order();
    data.items[0].productName = '<script>alert("producto")</script>';
    data.customer.fullName = '<img src=x onerror="alert(1)">';
    const done = printShippingGuide({ ...guide, guideNumber: '</title><script>alert(1)</script>' }, [data], { name: '<script>alert("empresa")</script>', logoUrl: 'x" onerror="alert(1)' });
    const doc = popup.document();
    expect(doc.querySelector("script,[onerror]")).toBeNull();
    expect(doc.body.textContent).toContain(data.items[0].productName);
    expect(doc.body.textContent).toContain(data.customer.fullName);
    expect(doc.querySelectorAll(".unit-code")).toHaveLength(2);
    popup.win.onload?.(); await done;
  });
  it("NONE conserva el contenido y no agrega bloques ni avisos", async () => {
    const popup = windowFixture();
    const done = printShippingGuide(guide, [{ ...order(), items: [order().items[1]] }]);
    expect(popup.document().querySelector("td.cont")?.innerHTML).toBe('<span class="q">1×</span> Accesorio');
    expect(popup.document().querySelector(".unit-codes")).toBeNull();
    expect(popup.document().body.textContent).toContain("Página 1 de 1");
    expect(popup.document().querySelector("style")?.textContent).not.toContain(".section, tbody, tbody tr");
    popup.win.onload?.(); await done;
  });
  it("no abre una ventana si el contexto ya cambió", async () => {
    windowFixture();
    await printShippingGuide(guide, [order()], undefined, { isCurrent: () => false });
    expect(window.open).not.toHaveBeenCalled();
  });
  it("cierra inmediatamente por abort mientras carga y nunca imprime tarde", async () => {
    const popup = windowFixture(), controller = new AbortController();
    const done = printShippingGuide(guide, [order()], undefined, { signal: controller.signal });
    const lateLoad = popup.win.onload;
    controller.abort(); await done;
    expect(popup.win.close).toHaveBeenCalled();
    lateLoad?.();
    expect(popup.win.print).not.toHaveBeenCalled();
  });
  it("comprueba de nuevo el contexto antes de imprimir", async () => {
    const popup = windowFixture(); let current = true;
    const done = printShippingGuide(guide, [order()], undefined, { isCurrent: () => current });
    current = false; popup.win.onload?.(); await done;
    expect(popup.win.print).not.toHaveBeenCalled();
    expect(popup.win.close).toHaveBeenCalled();
  });
  it("propaga un fallo de impresión y cierra la ventana", async () => {
    const popup = windowFixture(); popup.win.print.mockImplementation(() => { throw new Error("print failed"); });
    const done = printShippingGuide(guide, [order()]);
    popup.win.onload?.();
    await expect(done).rejects.toThrow("print failed");
    expect(popup.win.close).toHaveBeenCalled();
  });
});
