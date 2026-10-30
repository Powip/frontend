import QRCode from "qrcode";
import { waitFor } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";
import { printOrderLabel, printOrderLabelsBatch, type OrderReceipt } from "../printOrderLabel";

jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("") }));
jest.mock("jsbarcode", () => jest.fn());
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const baseReceipt = (): OrderReceipt => ({
  orderId: id(1), orderNumber: "PED-1", status: "PENDIENTE", createdAt: "2026-10-17T12:00:00Z",
  unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true, stockVersion: 2, confirmedStockVersion: 2,
  customer: { fullName: "Cliente" },
  items: [{ productName: "Teléfono", quantity: 2, unitPrice: 100, subtotal: 200, discountAmount: 0,
    trackingMode: "IMEI", unitIds: [id(10), id(11)], units: [
      { id: id(10), code: "000000000000001", status: "RESERVED" },
      { id: id(11), code: "000000000000002", status: "RESERVED" },
    ] }],
  payments: [],
  totals: { productsTotal: 200, taxTotal: 0, shippingTotal: 0, discountTotal: 0, grandTotal: 200, totalPaid: 0, pendingAmount: 200 },
});

function windowFixture(autoLoad = true) {
  let html = "";
  const popup = {
    document: {
      write: jest.fn((content: string) => { html = content; }),
      close: jest.fn(() => { if (autoLoad) queueMicrotask(() => popup.onload?.()); }),
    },
    onload: null as (() => void) | null,
    focus: jest.fn(), print: jest.fn(), close: jest.fn(),
  };
  jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  return { popup, document: () => new DOMParser().parseFromString(html, "text/html") };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("");
  jest.mocked(QRCode.toDataURL).mockResolvedValue("" as never);
});
afterEach(() => jest.restoreAllMocks());

it("prints the accepted agency and delivery mode from the receipt even with an older order header", async () => {
  const receipt = { ...baseReceipt(), delivery: { type: "AGENCY" as const, department: "Ancash", province: "Huaraz", district: "Huaraz", address: "Av. Nueva 456", agency: '<Shalom & Huaraz>' } };
  const view = windowFixture();
  await printOrderLabel(receipt, { deliveryType: "DOMICILIO", shalomDestinationAgency: "Agencia anterior" } as OrderHeader);
  const document = view.document();
  expect(document.body.textContent).toContain("<Shalom & Huaraz>");
  expect(document.body.textContent).toContain("Av. Nueva 456");
  expect(document.body.textContent).toContain("Retiro en agencia");
  expect(document.body.textContent).not.toContain("Agencia anterior");
  expect(document.querySelector("shalom")).toBeNull();
});

describe("customer comments on picking labels", () => {
  it("preserves all 500 characters and line breaks before totals without using internal or header notes", async () => {
    const prefix = "  Ingredientes: romero, sábila y biotina.\n";
    const suffix = "\nSin fragancia.  ";
    const customerNotes = prefix + "A".repeat(500 - prefix.length - suffix.length) + suffix;
    const receipt = { ...baseReceipt(), customerNotes, notes: "NOTA INTERNA PRIVADA" };
    const view = windowFixture();
    await printOrderLabel(receipt, {
      notes: "NOTA PRIVADA DE CABECERA",
      customerNotes: "COMENTARIO ANTERIOR DE CABECERA",
    } as OrderHeader);

    const document = view.document();
    const section = document.querySelector(".order-comments")!;
    const text = section.querySelector(".order-comments-text") as HTMLElement;
    expect(customerNotes).toHaveLength(500);
    expect(section.textContent).toContain("Comentarios del pedido");
    expect(text.textContent).toBe(customerNotes);
    expect(text.style.whiteSpace).toBe("pre-wrap");
    expect(text.style.overflowWrap).toBe("anywhere");
    expect(text.getAttribute("style")).not.toMatch(/hidden|ellipsis|clamp|max-height/);
    expect(section.compareDocumentPosition(document.querySelector(".totals")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(document.body.textContent).not.toMatch(/NOTA INTERNA PRIVADA|NOTA PRIVADA DE CABECERA|COMENTARIO ANTERIOR DE CABECERA/);
  });

  it.each([undefined, null, "", "  \n\t "])("omits blank customer comments (%p) instead of falling back to private notes", async (customerNotes) => {
    const receipt = { ...baseReceipt(), customerNotes, notes: "OBSERVACIÓN INTERNA" };
    if (customerNotes === undefined) delete receipt.customerNotes;
    const view = windowFixture();
    await printOrderLabel(receipt, {
      customerNotes: "COMENTARIO SOLO EN CABECERA",
      notes: "OBSERVACIÓN INTERNA DE CABECERA",
    } as OrderHeader);
    const document = view.document();
    expect(document.querySelector(".order-comments")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Comentarios del pedido|OBSERVACIÓN INTERNA|COMENTARIO SOLO EN CABECERA/);
  });

  it("prints HTML and entity syntax as literal comment text in the popup document", async () => {
    const customerNotes = '</div><script>alert("comentario")</script><img src=x onerror="alert(1)"> & " \' &lt;b&gt;';
    const view = windowFixture();
    await printOrderLabel({ ...baseReceipt(), customerNotes }, null);
    const document = view.document();
    expect(document.querySelector(".order-comments-text")?.textContent).toBe(customerNotes);
    expect(document.querySelector("script,[onerror]")).toBeNull();
    expect(document.querySelector(".order-comments-text")?.children).toHaveLength(0);
  });

  it("keeps each comment with its own batch label and omits a legacy-only comment", async () => {
    const first = { ...baseReceipt(), customerNotes: "Romero\nSin fragancia", notes: "PRIVADO-UNO" };
    const second = { ...baseReceipt(), orderId: id(2), orderNumber: "PED-2", notes: "PRIVADO-DOS" };
    const third = { ...baseReceipt(), orderId: id(3), orderNumber: "PED-3", customerNotes: "Sábila para el tercer pedido" };
    const view = windowFixture();
    await printOrderLabelsBatch([first, second, third].map(receipt => ({ receipt, orderHeader: null })));
    const document = view.document();
    const pages = Array.from(document.querySelectorAll(".label-page"));
    expect(pages).toHaveLength(3);
    expect(pages.map(page => page.querySelector(".order-comments-text")?.textContent)).toEqual([
      first.customerNotes, undefined, third.customerNotes,
    ]);
    expect(document.querySelectorAll(".order-comments")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/PRIVADO-UNO|PRIVADO-DOS/);
  });
});

it("prints every confirmed IMEI under its product with leading zeros", async () => {
  const view = windowFixture();
  await printOrderLabel(baseReceipt(), null);
  const product = view.document().querySelector(".pick-body")!;
  expect(product.querySelector(".pick-name")?.textContent).toBe("Teléfono");
  expect(Array.from(product.querySelectorAll(".unit-code")).map(node => node.textContent)).toEqual([
    "IMEI: 000000000000001", "IMEI: 000000000000002",
  ]);
  expect(view.popup.print).toHaveBeenCalledTimes(1);
});

it("preserves all long series and permits wrapping without truncation or line clamps", async () => {
  const receipt = baseReceipt();
  const codes = Array.from({ length: 12 }, (_, index) => `SERIE-${index}-${"A".repeat(90)}`);
  receipt.items[0] = { ...receipt.items[0], trackingMode: "SERIAL", quantity: codes.length,
    unitIds: codes.map((_, n) => id(50 + n)),
    units: codes.map((code, n) => ({ id: id(50 + n), code, status: "RESERVED" })),
  };
  const view = windowFixture();
  await printOrderLabel(receipt, null);
  const elements = Array.from(view.document().querySelectorAll(".unit-code"));
  expect(elements.map(node => node.textContent)).toEqual(codes.map(code => `Serie: ${code}`));
  const container = view.document().querySelector(".unit-codes") as HTMLElement;
  expect(container.style.overflowWrap).toBe("anywhere");
  expect(container.style.whiteSpace).toBe("normal");
  expect(container.getAttribute("style")).not.toMatch(/hidden|ellipsis|clamp|max-height/);
});

it("keeps NONE label content without an empty code section", async () => {
  const receipt = baseReceipt();
  receipt.unitAssignmentStatus = "NONE";
  receipt.items[0].trackingMode = "NONE";
  const view = windowFixture();
  await printOrderLabel(receipt, null);
  expect(view.document().querySelector(".unit-codes")).toBeNull();
  expect(view.document().querySelector(".pick-qty .num")?.textContent).toBe("2");
  expect(view.document().querySelector(".pick-name")?.textContent).toBe("Teléfono");
  expect(view.document().querySelector(".pick-price")?.textContent).toBe("S/ 200.00");
});

it.each([
  ["IMEI", "POR DESPACHAR"],
  ["NONE", "ENTREGADO"],
])("uses the receipt status for %s and preserves the NONE header preference", async (mode, expected) => {
  const receipt = baseReceipt();
  receipt.items[0].trackingMode = mode;
  const view = windowFixture();
  await printOrderLabel(receipt, { status: "ENTREGADO" } as OrderHeader);
  expect(view.document().querySelector(".status-badge")?.textContent).toBe(expected);
});

it("prints a confirmation notice instead of stale unit codes", async () => {
  const receipt = baseReceipt();
  receipt.confirmedStockVersion = 1;
  const view = windowFixture();
  await printOrderLabel(receipt, null);
  expect(view.document().querySelectorAll(".unit-code")).toHaveLength(0);
  expect(view.document().querySelector(".unit-code-notice")?.textContent).toMatch(/pendientes de confirmación/);
});

it("does not interpolate malicious or malformed codes as HTML", async () => {
  const receipt = baseReceipt();
  receipt.items[0].trackingMode = "SERIAL";
  receipt.items[0].units![0].code = '<img src=x onerror="alert(1)">';
  const view = windowFixture();
  await printOrderLabel(receipt, null);
  expect(view.document().querySelector("img[onerror],script")).toBeNull();
  expect(view.document().querySelector(".unit-code-notice")?.textContent).toMatch(/no disponibles/);
});

it("escapes surrounding receipt text and attributes so it cannot execute beside private codes", async () => {
  const receipt = baseReceipt();
  const attack = '</title><script>alert(1)</script><img src=x onerror="alert(1)">';
  receipt.orderNumber = attack;
  receipt.customer.fullName = attack;
  receipt.customer.address = attack;
  receipt.items[0].productName = attack;
  receipt.items[0].sku = attack;
  receipt.items[0].attributes = { color: attack };
  receipt.shippingOffice = attack;
  const view = windowFixture();
  await printOrderLabel(receipt, null, { name: attack, logoUrl: 'x" onerror="alert(1)' });
  const document = view.document();
  expect(document.querySelector('script,[onerror]')).toBeNull();
  expect(document.title).toBe(`Etiqueta - ${attack}`);
  expect(document.querySelector('.pick-name')?.textContent).toBe(attack);
  expect(document.querySelectorAll('.unit-code')).toHaveLength(2);
});

it("prints batch snapshots per order, preserving page breaks and returned-sale historical notice", async () => {
  const receipt = baseReceipt();
  receipt.status = "ANULADO";
  receipt.items[0].units!.forEach(unit => { unit.status = "AVAILABLE"; });
  const normal = baseReceipt();
  normal.orderId = id(2); normal.orderNumber = "PED-2"; normal.items[0].trackingMode = "NONE";
  const view = windowFixture();
  await printOrderLabelsBatch([{ receipt, orderHeader: null }, { receipt: normal, orderHeader: null }]);
  const pages = view.document().querySelectorAll(".label-page");
  expect(pages).toHaveLength(2);
  expect(pages[0].getAttribute("style")).toContain("page-break-after: always");
  expect(pages[0].querySelectorAll(".unit-code")).toHaveLength(2);
  expect(pages[0].querySelector(".unit-code-notice")?.textContent).toMatch(/histórica/);
  expect(pages[1].querySelector(".unit-codes")).toBeNull();
});

it("closes the popup without writing private HTML if session changes during QR generation", async () => {
  let resolveQr!: (value: string) => void;
  jest.mocked(QRCode.toDataURL).mockImplementationOnce(() => new Promise(resolve => { resolveQr = resolve; }) as never);
  let current = true;
  const view = windowFixture();
  const printing = printOrderLabelsBatch([{ receipt: baseReceipt(), orderHeader: null }], null, () => current);
  current = false;
  resolveQr("");
  await printing;
  expect(view.popup.document.write).not.toHaveBeenCalled();
  expect(view.popup.print).not.toHaveBeenCalled();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
});

it("checks the session again before the browser print callback", async () => {
  let current = true;
  const view = windowFixture(false);
  const printing = printOrderLabelsBatch([{ receipt: baseReceipt(), orderHeader: null }], null, () => current);
  await waitFor(() => expect(view.popup.onload).toEqual(expect.any(Function)));
  current = false;
  view.popup.onload?.();
  await printing;
  expect(view.popup.print).not.toHaveBeenCalled();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
});

it("closes immediately on abort while QR generation is still pending", async () => {
  let resolveQr!: (value: string) => void;
  jest.mocked(QRCode.toDataURL).mockImplementationOnce(() => new Promise(resolve => { resolveQr = resolve; }) as never);
  const controller = new AbortController();
  const view = windowFixture();
  const printing = printOrderLabelsBatch([{ receipt: baseReceipt(), orderHeader: null }], null, undefined, controller.signal);
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.document.write).not.toHaveBeenCalled();
  resolveQr('');
  await printing;
  expect(view.popup.print).not.toHaveBeenCalled();
});

it("closes and resolves immediately if the session aborts while images are loading", async () => {
  const controller = new AbortController();
  const view = windowFixture(false);
  const printing = printOrderLabelsBatch([{ receipt: baseReceipt(), orderHeader: null }], null, undefined, controller.signal);
  await waitFor(() => expect(view.popup.onload).toEqual(expect.any(Function)));
  expect(view.popup.document.write).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.onload).toBeNull();
  await printing;
  expect(view.popup.print).not.toHaveBeenCalled();
});

it.each(['aborted', 'stale'])("does not open a single-label popup when options are already %s", async (state) => {
  const controller = new AbortController();
  if (state === 'aborted') controller.abort();
  const view = windowFixture();
  await printOrderLabel(baseReceipt(), null, null, {
    signal: controller.signal, isCurrent: () => state !== 'stale',
  });
  expect(window.open).not.toHaveBeenCalled();
  expect(view.popup.document.write).not.toHaveBeenCalled();
});

it("closes a single-label popup immediately when aborted during QR generation", async () => {
  let resolveQr!: (value: string) => void;
  jest.mocked(QRCode.toDataURL).mockImplementationOnce(() => new Promise(resolve => { resolveQr = resolve; }) as never);
  const controller = new AbortController();
  const view = windowFixture();
  const printing = printOrderLabel(baseReceipt(), null, null, { signal: controller.signal });
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.document.write).not.toHaveBeenCalled();
  resolveQr('');
  await printing;
  expect(view.popup.print).not.toHaveBeenCalled();
});

it("rechecks the single-label scope after QR completes before writing private HTML", async () => {
  let resolveQr!: (value: string) => void;
  jest.mocked(QRCode.toDataURL).mockImplementationOnce(() => new Promise(resolve => { resolveQr = resolve; }) as never);
  let current = true;
  const view = windowFixture();
  const printing = printOrderLabel(baseReceipt(), null, null, { isCurrent: () => current });
  current = false;
  resolveQr('');
  await printing;
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.document.write).not.toHaveBeenCalled();
  expect(view.popup.print).not.toHaveBeenCalled();
});

it("closes a single-label popup and resolves without waiting for its images after abort", async () => {
  const controller = new AbortController();
  const view = windowFixture(false);
  const printing = printOrderLabel(baseReceipt(), null, null, { signal: controller.signal });
  await waitFor(() => expect(view.popup.onload).toEqual(expect.any(Function)));
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.onload).toBeNull();
  await printing;
  expect(view.popup.print).not.toHaveBeenCalled();
});

it("closes the single-label popup and releases the abort listener if building the document fails", async () => {
  const controller = new AbortController();
  const receipt = baseReceipt();
  receipt.createdAt = 'invalid date';
  const view = windowFixture();
  await expect(printOrderLabel(receipt, null, null, { signal: controller.signal })).rejects.toThrow();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  expect(view.popup.document.write).not.toHaveBeenCalled();
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
});

it("closes the popup and rejects cleanly if the browser print callback fails", async () => {
  const controller = new AbortController();
  const view = windowFixture();
  view.popup.print.mockImplementation(() => { throw new Error('Printer unavailable'); });
  await expect(printOrderLabel(baseReceipt(), null, null, { signal: controller.signal })).rejects.toThrow('Printer unavailable');
  expect(view.popup.close).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(view.popup.close).toHaveBeenCalledTimes(1);
});
