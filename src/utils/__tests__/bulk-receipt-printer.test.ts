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
});
