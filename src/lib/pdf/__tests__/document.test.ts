/**
 * @jest-environment node
 */
import { downloadPdf, footerText, pdfText, renderPdf, safeFileName, type PdfDeps, type PdfDoc, type PdfDocSpec } from "../document";
import { buildPdfContext, pdfUserName } from "../context";

// FEAT-24 H10-D4 — el helper arma encabezado, tablas y pie sin renderizar de verdad: jsPDF y autotable se
// reemplazan por dobles que anotan lo que se dibuja.

interface Drawn {
  page: number;
  text: string;
  x: number;
  y: number;
}

function fakeDeps(options: { pages?: number } = {}) {
  const texts: Drawn[] = [];
  const images: unknown[][] = [];
  const tables: Array<{ head: unknown; body: unknown; startY: unknown }> = [];
  let page = 1;
  let pages = 1;
  const doc: PdfDoc = {
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn(),
    rect: jest.fn(),
    line: jest.fn(),
    text: (text, x, y) => {
      texts.push({ page, text: Array.isArray(text) ? text.join("\n") : text, x, y });
    },
    splitTextToSize: (text) => [text],
    addImage: (...args) => {
      images.push(args);
    },
    getImageProperties: () => ({ width: 200, height: 100 }),
    addPage: () => {
      pages += 1;
      page = pages;
    },
    getNumberOfPages: () => pages,
    setPage: (value) => {
      page = value;
    },
    save: jest.fn(),
  };
  const deps: PdfDeps = {
    createDoc: jest.fn(() => doc),
    autoTable: jest.fn((target: PdfDoc, opts) => {
      tables.push({ head: opts.head, body: opts.body, startY: opts.startY });
      // La tabla ocupa más de una página.
      for (let extra = 1; extra < (options.pages ?? 1); extra++) target.addPage();
      target.lastAutoTable = { finalY: 120 };
    }),
  };
  return { doc, deps, texts, images, tables };
}

const SPEC: PdfDocSpec = {
  title: "Orden de compra",
  number: "OC-0007",
  date: "18/11/2026",
  meta: [["Proveedor", "Textiles Lima SAC"]],
  tables: [{ head: ["SKU", "Producto", "Cantidad"], rows: [["POL-M", "Polo · Talla: M", "24"]], align: ["left", "left", "right"] }],
  foot: [["Total", "S/ 1,416.00"]],
  signatures: ["Elaborado por", "Proveedor (conformidad)"],
  fileName: "OC-0007",
};

const CTX = {
  company: { name: "KUNCA SAC", ruc: "20601234567", address: "Av. Arequipa 123", logoDataUrl: "data:image/png;base64,AAAA", storeName: "KUNCA Miraflores" },
  userName: "Ana Pérez",
  printedAt: new Date("2026-11-18T15:30:00Z"),
};

describe("renderPdf (encabezado y pie comunes)", () => {
  it("dibuja logo, empresa, tienda, título, número y fecha en el encabezado", () => {
    const { deps, texts, images } = fakeDeps();
    renderPdf(SPEC, CTX, deps);
    const first = texts.filter((item) => item.page === 1).map((item) => item.text);
    expect(images).toHaveLength(1);
    expect(images[0][1]).toBe("PNG");
    expect(first).toEqual(expect.arrayContaining(["KUNCA SAC", "RUC 20601234567 · Av. Arequipa 123", "Tienda: KUNCA Miraflores", "Orden de compra", "OC-0007", "Fecha: 18/11/2026"]));
    expect(first).toEqual(expect.arrayContaining(["PROVEEDOR", "Textiles Lima SAC", "Total", "S/ 1,416.00", "Elaborado por", "Proveedor (conformidad)"]));
  });

  it("pasa las tablas a autotable con su encabezado y sus filas", () => {
    const { deps, tables } = fakeDeps();
    renderPdf(SPEC, CTX, deps);
    expect(deps.autoTable).toHaveBeenCalledTimes(1);
    expect(tables[0].head).toEqual([["SKU", "Producto", "Cantidad"]]);
    expect(tables[0].body).toEqual([["POL-M", "Polo · Talla: M", "24"]]);
    expect(deps.autoTable).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ columnStyles: { 2: { halign: "right" } } }));
  });

  it("pone el pie con usuario, fecha de impresión y página en todas las páginas", () => {
    const { deps, texts } = fakeDeps({ pages: 2 });
    renderPdf(SPEC, CTX, deps);
    const footers = texts.filter((item) => item.text.startsWith("Generado por POWIP"));
    expect(footers.map((item) => [item.page, item.text])).toEqual([
      [1, "Generado por POWIP · Impreso el 18/11/2026 10:30 por Ana Pérez · Página 1 de 2"],
      [2, "Generado por POWIP · Impreso el 18/11/2026 10:30 por Ana Pérez · Página 2 de 2"],
    ]);
  });

  it("FEAT-24 H12: dibuja la imagen del pie (el QR de la guía) con su texto al lado", () => {
    const { deps, images, texts } = fakeDeps();
    renderPdf({ ...SPEC, image: { dataUrl: "data:image/png;base64,QR", caption: "Consulta esta guía en SUNAT" } }, { ...CTX, company: { name: "KUNCA SAC" } }, deps);
    expect(images).toHaveLength(1);
    expect(images[0].slice(0, 2)).toEqual(["data:image/png;base64,QR", "PNG"]);
    expect(texts.map((item) => item.text)).toContain("Consulta esta guía en SUNAT");
  });

  it("sin logo escribe solo el nombre de la empresa; una tabla vacía dice «Sin datos.»", () => {
    const { deps, images, tables } = fakeDeps();
    renderPdf({ ...SPEC, tables: [{ head: ["A", "B"], rows: [] }] }, { ...CTX, company: { name: "KUNCA SAC" } }, deps);
    expect(images).toHaveLength(0);
    expect(tables[0].body).toEqual([[{ content: "Sin datos.", colSpan: 2 }]]);
  });

  it("descarga con un nombre de archivo limpio y en horizontal si se pide", () => {
    const { deps, doc } = fakeDeps();
    downloadPdf({ ...SPEC, landscape: true, fileName: "Reporte general · 2026/11" }, CTX, deps);
    expect(deps.createDoc).toHaveBeenCalledWith({ orientation: "landscape", unit: "mm", format: "a4" });
    expect(doc.save).toHaveBeenCalledWith("Reporte-general-2026-11.pdf");
  });
});

describe("texto y contexto del PDF", () => {
  it("reemplaza lo que las fuentes estándar no tienen", () => {
    expect(pdfText("Ajuste − 3 → OK ✓")).toBe("Ajuste - 3 -> OK ?");
    expect(pdfText("Año · ñandú •••• — 50%")).toBe("Año · ñandú •••• — 50%");
    expect(pdfText(null)).toBe("");
  });

  it("el pie usa el usuario y la página", () => {
    expect(footerText({ ...CTX, userName: "" }, 3, 4)).toContain("por — · Página 3 de 4");
    expect(safeFileName("")).toBe("documento.pdf");
  });

  it("arma el contexto con la empresa, la tienda y el logo de la sesión", async () => {
    const loadLogo = jest.fn(async () => "data:image/jpeg;base64,BBBB");
    const ctx = await buildPdfContext(
      { name: "KUNCA SAC", cuit: "20601234567", billingAddress: "Av. Arequipa 123", phone: "999", logoUrl: "https://x/logo.jpg", stores: [{ id: "s1", name: "Miraflores" }] },
      { email: "ana@kunca.pe", name: "Ana", surname: "Pérez" },
      { storeId: "s1", loadLogo },
    );
    expect(loadLogo).toHaveBeenCalledWith("https://x/logo.jpg");
    expect(ctx.company).toEqual({ name: "KUNCA SAC", ruc: "20601234567", address: "Av. Arequipa 123", phone: "999", storeName: "Miraflores", logoDataUrl: "data:image/jpeg;base64,BBBB" });
    expect(ctx.userName).toBe("Ana Pérez");
    expect(pdfUserName({ email: "ops@kunca.pe" })).toBe("ops@kunca.pe");
  });
});
