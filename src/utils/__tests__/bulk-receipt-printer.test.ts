jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: jest.fn(async (text: string) => `data:qr,${text}`) },
}));

jest.mock("jsbarcode", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import {
  buildReceiptsDocument,
  printReceipts,
  type ReceiptData,
} from "@/utils/bulk-receipt-printer";

const receipt = (orderNumber: string): ReceiptData => ({
  orderId: `id-${orderNumber}`,
  orderNumber,
  status: "PENDIENTE",
  customer: { fullName: `Cliente ${orderNumber}` },
});

const RECEIPTS = [receipt("ORD-003"), receipt("ORD-001"), receipt("ORD-002")];
const COMPANY = { name: "Powip Test" };
const unitId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const trackedReceipt = (): ReceiptData => ({
  ...receipt("SERIAL-001"),
  unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true,
  stockVersion: 2, confirmedStockVersion: 2,
  items: [{ productName: "Equipo", quantity: 2, unitPrice: 10, subtotal: 20, discountAmount: 0,
    trackingMode: "SERIAL", unitIds: [unitId(1), unitId(2)],
    units: [{ id: unitId(1), code: "0" + "X".repeat(99), status: "RESERVED" }, { id: unitId(2), code: "SERIE-2", status: "RESERVED" }] },
    { productName: "Accesorio", trackingMode: "NONE", quantity: 1, unitPrice: 5, subtotal: 5, discountAmount: 0 }],
});

function fakePrintWindow() {
  const written: string[] = [];
  const win = {
    document: {
      open: jest.fn(),
      write: jest.fn((html: string) => written.push(html)),
      close: jest.fn(),
    },
    focus: jest.fn(),
    print: jest.fn(),
    close: jest.fn(),
    onload: null as null | (() => void),
  };
  return { win, written };
}

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:barcode");
});

describe("buildReceiptsDocument", () => {
  it("arma una etiqueta por recibo respetando el orden recibido", async () => {
    const html = await buildReceiptsDocument(RECEIPTS, COMPANY);

    const positions = ["ORD-003", "ORD-001", "ORD-002"].map((n) =>
      html.indexOf(`Cliente ${n}`),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/page-break-after: always/g)).toHaveLength(2);
    expect(html).toContain("@page { margin: 5mm; size: 100mm auto; }");
  });

  it("rechaza una lista vacía", async () => {
    await expect(buildReceiptsDocument([], COMPANY)).rejects.toThrow("No receipts to print");
  });
  it("conserva todos los códigos largos por producto y todos los comprobantes del lote", async () => {
    const html = await buildReceiptsDocument([trackedReceipt(), receipt("NORMAL-002")], COMPANY);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect([...doc.querySelectorAll(".unit-code")].map(node => node.textContent)).toEqual(["Serie: 0" + "X".repeat(99), "Serie: SERIE-2"]);
    expect(doc.body.textContent).toContain("Accesorio");
    expect(doc.body.textContent).toContain("NORMAL-002");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html.match(/page-break-after: always/g)).toHaveLength(1);
  });
  it("muestra aviso sin imprimir códigos no confirmados", async () => {
    const data = trackedReceipt();
    data.stockVersion = 3;
    const html = await buildReceiptsDocument([data], COMPANY);
    expect(html).toContain("Códigos pendientes de confirmación.");
    expect(html).not.toContain("SERIE-2");
    expect(html).not.toContain("X".repeat(99));
  });
  it("escapa textos del documento sin alterar totales ni insertar HTML ejecutable", async () => {
    const data = trackedReceipt();
    data.items![0].productName = '<script>alert("producto")</script>';
    data.items![0].attributes = { color: '<img src=x onerror="alert(1)">' };
    const html = await buildReceiptsDocument([data], { name: '<script>alert("empresa")</script>' });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelector("[onerror]")).toBeNull();
    expect(doc.body.textContent).toContain(data.items![0].productName);
    expect(doc.body.textContent).toContain("S/ 20.00");
    expect(doc.querySelectorAll(".unit-code")).toHaveLength(2);
  });
});

describe("printReceipts", () => {
  it("escribe en la ventana exactamente el mismo documento que la vista previa", async () => {
    const expected = await buildReceiptsDocument(RECEIPTS, COMPANY);
    const { win, written } = fakePrintWindow();

    const done = printReceipts(RECEIPTS, COMPANY, win as unknown as Window);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    win.onload?.();
    await done;

    expect(written).toEqual([expected]);
    expect(win.print).toHaveBeenCalledTimes(1);
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it("falla con un mensaje claro si la ventana fue bloqueada", async () => {
    await expect(printReceipts(RECEIPTS, COMPANY, null)).rejects.toThrow(
      /popups no estén bloqueados/,
    );
  });
  it("descarta el documento cuando el scope cambia durante la generación", async () => {
    const { win } = fakePrintWindow();
    await expect(printReceipts([trackedReceipt()], COMPANY, win as unknown as Window, () => false)).rejects.toThrow("La sesión cambió");
    expect(win.document.write).not.toHaveBeenCalled();
    expect(win.print).not.toHaveBeenCalled();
    expect(win.close).toHaveBeenCalledTimes(1);
  });
  it("no imprime si el scope cambia después de construir el HTML pero antes de onload", async () => {
    const { win } = fakePrintWindow();
    let current = true;
    const done = printReceipts([trackedReceipt()], COMPANY, win as unknown as Window, () => current);
    const rejection = expect(done).rejects.toThrow("La sesión cambió");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(win.document.write).toHaveBeenCalledTimes(1);
    current = false;
    win.onload?.();
    await rejection;
    expect(win.print).not.toHaveBeenCalled();
  });
});
