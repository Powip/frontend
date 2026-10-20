import QRCode from "qrcode";
import { waitFor } from "@testing-library/react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  buildNotaVentaHtml,
  downloadNotaVentaPdf,
  NOTA_VENTA_PAGE_HEIGHT,
  paginateNotaVentaDocument,
} from "../downloadNotaVentaPdf";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { OrderReceipt } from "../printOrderLabel";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue("") },
}));
jest.mock("html2canvas-pro", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("jspdf", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const fixture = (count = 1, tracked = true): OrderReceipt => {
  const units = Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    code: String(i + 1).padStart(15, "0"),
    status: "RESERVED",
  }));
  return {
    orderId: "order",
    orderNumber: "NV-001",
    status: "PENDIENTE",
    createdAt: "2026-10-17T12:00:00Z",
    unitAssignmentStatus: "CONFIRMED",
    unitCatalogValidated: true,
    stockVersion: 2,
    confirmedStockVersion: 2,
    customer: { fullName: "Cliente", phoneNumber: "999111222", address: "Av. Central" },
    items: [
      {
        productName: "Celular azul",
        sku: "PHONE-BLUE",
        quantity: count,
        unitPrice: 10,
        subtotal: count * 10,
        discountAmount: 0,
        trackingMode: tracked ? "IMEI" : "NONE",
        ...(tracked ? { unitIds: units.map((u) => u.id), units } : {}),
      },
    ],
    payments: [],
    totals: {
      productsTotal: count * 10,
      taxTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      grandTotal: count * 10,
      totalPaid: 0,
      pendingAmount: count * 10,
    },
  };
};
function rootFor(receipt: OrderReceipt) {
  document.body.innerHTML = buildNotaVentaHtml(receipt, null, { name: "Empresa" });
  return document.getElementById("pdf-comprobante-root")!;
}
// JSDOM has no layout engine. Model measured block heights so the actual DOM
// pagination can be exercised; the browser/PDF visual run verifies real fonts.
function height(element: Element): number {
  if (element.hasAttribute("data-test-height"))
    return Number(element.getAttribute("data-test-height"));
  if (element.classList.contains("nota-venta-content"))
    return Array.from(element.children).reduce((sum, child) => sum + height(child), 0);
  if (element.matches("table.items"))
    return (
      44 +
      Array.from(element.querySelectorAll("tbody tr")).reduce(
        (sum, row) => sum + (row.classList.contains("unit-row") ? 20 : 35),
        0,
      )
    );
  const sizes: Record<string, number> = {
    "head-row": 75,
    divider: 22,
    "summary-row": 110,
    "customer-box": 120,
    closing: 250,
    "page-heading": 35,
  };
  return Object.entries(sizes).find(([name]) => element.classList.contains(name))?.[1] ?? 10;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      height: height(this),
      width: 736,
      top: 0,
      left: 0,
      bottom: height(this),
      right: 736,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = "";
});

test("prints every confirmed code as text below its product without losing leading zeroes", () => {
  const receipt = fixture(3);
  const root = rootFor(receipt);
  const group = root.querySelector("tbody")!;
  expect(group.rows).toHaveLength(4);
  expect(group.rows[0]).toHaveTextContent("Celular azul");
  expect(
    Array.from(group.querySelectorAll("[data-pdf-unit-code]")).map((row) =>
      row.getAttribute("data-pdf-unit-code"),
    ),
  ).toEqual(receipt.items[0].units!.map((unit) => unit.code));
  expect(group.rows[1]).toHaveTextContent("IMEI: 000000000000001");
});
test.each(["PENDING", "REJECTED", "STALE"])(
  "prints an explanation without candidate codes for %s assignment",
  (state) => {
    const receipt = fixture();
    if (state === "STALE") receipt.confirmedStockVersion = 1;
    else receipt.unitAssignmentStatus = state;
    const root = rootFor(receipt);
    expect(root).toHaveTextContent("Códigos pendientes de confirmación.");
    expect(root.textContent).not.toContain(receipt.items[0].units![0].code);
  },
);
test("escapes product, customer and company HTML while preserving readable receipt text", () => {
  const receipt = fixture();
  receipt.customer.fullName = '<img src="x" onerror="alert(1)">';
  receipt.items[0].productName = "Teléfono <script>alert(2)</script>";
  receipt.items[0].attributes = { "<b>Color</b>": '"Azul" & blanco' };
  document.body.innerHTML = buildNotaVentaHtml(receipt, null, {
    name: "<script>empresa</script>",
    billingAddress: '<img src="y">',
  });
  expect(document.body.querySelector("script")).toBeNull();
  expect(document.body.querySelector("[onerror]")).toBeNull();
  expect(document.body.textContent).toContain(receipt.customer.fullName);
  expect(document.body.textContent).toContain(receipt.items[0].productName);
});
test("quantity-only notes preserve one page when they fit and do not gain unit labels", () => {
  const root = rootFor(fixture(1, false));
  const pages = paginateNotaVentaDocument(root);
  expect(pages).toHaveLength(1);
  expect(pages[0]).toHaveTextContent("Celular azul");
  expect(pages[0]).toHaveTextContent("S/ 10.00");
  expect(pages[0].querySelector(".unit-row")).toBeNull();
  expect(pages[0]).toHaveTextContent("Página 1 de 1");
});
test("paginates a large product at code row boundaries, preserving all rows, totals and continuation context", () => {
  const receipt = fixture(110);
  const root = rootFor(receipt);
  const pages = paginateNotaVentaDocument(root);
  expect(pages.length).toBeGreaterThan(2);
  const codes = pages.flatMap((page) =>
    Array.from(page.querySelectorAll<HTMLElement>("[data-pdf-unit-code]")).map(
      (row) => row.dataset.pdfUnitCode,
    ),
  );
  expect(codes).toEqual(receipt.items[0].units!.map((unit) => unit.code));
  expect(new Set(codes).size).toBe(110);
  for (const page of pages) {
    expect(height(page.querySelector(".nota-venta-content")!)).toBeLessThanOrEqual(
      NOTA_VENTA_PAGE_HEIGHT - 72,
    );
    if (page.querySelector("table")) expect(page.querySelectorAll("thead")).toHaveLength(1);
  }
  const productPage = pages.find((page) => page.querySelector("[data-pdf-product-row]"))!;
  expect(productPage.querySelector("[data-pdf-unit-code]")).not.toBeNull();
  expect(root.querySelectorAll("[data-pdf-continuation]").length).toBeGreaterThan(0);
  expect(root.querySelector("[data-pdf-continuation]")).toHaveTextContent(
    "Celular azul (continuación)",
  );
  expect(pages.at(-1)).toHaveTextContent("S/ 1100.00");
  expect(pages.at(-1)).toHaveTextContent("Gracias por tu compra.");
});
test("does not truncate a maximum-length serial or put candidate ids into print output", () => {
  const receipt = fixture();
  const serial = `00${"Z".repeat(98)}`;
  receipt.items[0].trackingMode = "SERIAL";
  receipt.items[0].units![0].code = serial;
  const root = rootFor(receipt);
  paginateNotaVentaDocument(root);
  expect(root.querySelector(".unit-code")?.textContent).toBe(`Serie: ${serial}`);
  expect(root.textContent).not.toContain(receipt.items[0].unitIds![0]);
});
test("fails instead of silently clipping an indivisible block taller than a page", () => {
  const root = rootFor(fixture());
  root.querySelector(".customer-box")!.setAttribute("data-test-height", "2000");
  expect(() => paginateNotaVentaDocument(root)).toThrow("supera una página");
});
test("downloads each measured page as its own canvas/A4 image and always removes the private iframe", async () => {
  const doc = document.implementation.createHTMLDocument("PDF");
  jest.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(doc);
  const pdf = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: jest.fn(),
    addImage: jest.fn(),
    save: jest.fn(),
  };
  jest.mocked(jsPDF).mockImplementation(() => pdf as unknown as jsPDF);
  jest
    .mocked(html2canvas)
    .mockResolvedValue({ toDataURL: () => "data:image/jpeg;base64,canvas" } as HTMLCanvasElement);
  await downloadNotaVentaPdf(fixture(110), null);
  const canvases = jest.mocked(html2canvas).mock.calls;
  expect(canvases.length).toBeGreaterThan(2);
  expect(canvases.every(([target]) => target.hasAttribute("data-pdf-page"))).toBe(true);
  expect(pdf.addPage).toHaveBeenCalledTimes(canvases.length - 1);
  expect(pdf.addImage).toHaveBeenCalledTimes(canvases.length);
  expect(pdf.addImage).toHaveBeenCalledWith(expect.any(String), "JPEG", 0, 0, 210, 297);
  expect(pdf.save).toHaveBeenCalledWith("Comprobante_NV-001.pdf");
  expect(toast.error).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
});

test("tracked badges use the receipt state with its codes, while NONE retains its legacy header preference", () => {
  const tracked = fixture();
  tracked.status = "ENTREGADO";
  tracked.items[0].units![0].status = "SOLD";
  const staleHeader = { status: "ANULADO" } as OrderHeader;
  document.body.innerHTML = buildNotaVentaHtml(tracked, staleHeader);
  expect(document.querySelector(".status-badge")).toHaveTextContent("ENTREGADO");
  expect(document.querySelector(".unit-code")).toHaveTextContent("000000000000001");
  document.body.innerHTML = buildNotaVentaHtml(fixture(1, false), staleHeader);
  expect(document.querySelector(".status-badge")).toHaveTextContent("ANULADO");
});

test.each(["closed", "aborted"])(
  "does not begin generating a PDF if its originating dialog is already %s",
  async (state) => {
    const controller = new AbortController();
    if (state === "aborted") controller.abort();
    await downloadNotaVentaPdf(fixture(), null, undefined, {
      signal: controller.signal,
      isCurrent: () => state !== "closed",
    });
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
    expect(html2canvas).not.toHaveBeenCalled();
    expect(jsPDF).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  },
);

test("discards QR completion after the company or account changes without creating a private iframe", async () => {
  let complete!: (value: string) => void;
  jest.mocked(QRCode.toDataURL).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  );
  let current = true;
  const work = downloadNotaVentaPdf(fixture(), null, undefined, { isCurrent: () => current });
  current = false;
  complete("");
  await work;
  expect(html2canvas).not.toHaveBeenCalled();
  expect(jsPDF).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
});

test.each(["resolve", "reject"])(
  "silently discards a late canvas %s after cancellation and cleans up the iframe",
  async (outcome) => {
    const doc = document.implementation.createHTMLDocument("PDF");
    jest.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(doc);
    const pdf = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addPage: jest.fn(),
      addImage: jest.fn(),
      save: jest.fn(),
    };
    jest.mocked(jsPDF).mockImplementation(() => pdf as unknown as jsPDF);
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    let complete!: (value: HTMLCanvasElement) => void;
    let fail!: (reason: Error) => void;
    jest.mocked(html2canvas).mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          complete = resolve;
          fail = reject;
        }),
    );
    const controller = new AbortController();
    const work = downloadNotaVentaPdf(fixture(), null, undefined, { signal: controller.signal });
    await waitFor(() => expect(html2canvas).toHaveBeenCalledTimes(1));
    expect(document.querySelector("iframe")).not.toBeNull();
    controller.abort();
    if (outcome === "resolve")
      complete({ toDataURL: () => "data:image/jpeg;base64,unused" } as HTMLCanvasElement);
    else fail(new Error("Renderer ended after closing"));
    await work;
    expect(pdf.addImage).not.toHaveBeenCalled();
    expect(pdf.save).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  },
);
