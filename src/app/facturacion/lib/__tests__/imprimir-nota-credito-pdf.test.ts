import { toast } from "sonner";
import {
  buildNotaCreditoHtml,
  imprimirNotaCreditoPdf,
} from "@/app/facturacion/lib/imprimir-nota-credito-pdf";
import type { Nota } from "@/types/facturacion";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const issuer = { ruc: "20123456789", razonSocial: "Mi Empresa S.A.C.", direccion: "Av. Lima 123" };

const nota: Nota = {
  fecha: "19/11/2026",
  num: "FC01-00000001",
  original: "F002-00000012",
  tipoOriginal: "01",
  cliente: "DRASANVI PERU S.A.C.",
  motivo: "Devolución total",
  motivoCodigo: "06",
  monto: 2730,
  subtotal: 2313.56,
  igv: 416.44,
  estado: "ACEPTADO",
  items: [{ descripcion: "Polo <b>", cantidad: 2, precioUnitario: 1365, importe: 2730 }],
};

describe("buildNotaCreditoHtml", () => {
  const html = buildNotaCreditoHtml(nota, issuer);

  it("incluye emisor, tipo y número de la nota", () => {
    expect(html).toContain("RUC 20123456789");
    expect(html).toContain("Mi Empresa S.A.C.");
    expect(html).toContain("Nota de Crédito Electrónica");
    expect(html).toContain("FC01-00000001");
  });

  it("incluye comprobante que modifica, cliente y motivo con código", () => {
    expect(html).toContain("Factura electrónica (01) F002-00000012");
    expect(html).toContain("DRASANVI PERU S.A.C.");
    expect(html).toContain("06 · Devolución total");
  });

  it("incluye ítems escapados y montos", () => {
    expect(html).toContain("Polo &lt;b&gt;");
    expect(html).toContain("S/ 2313.56");
    expect(html).toContain("S/ 416.44");
    expect(html).toContain("S/ 2730.00");
    expect(html).toContain("19/11/2026");
  });

  it("advierte que no se envió a SUNAT y no afirma validez", () => {
    expect(html).toContain("no se envía ni se guarda en SUNAT");
    expect(html).toContain("No tiene validez tributaria");
    expect(html).not.toContain(">ACEPTADO<");
    expect(html).toContain("Vista previa");
  });

  it("calcula montos y código si la nota no los trae", () => {
    const sinMontos = buildNotaCreditoHtml(
      { ...nota, subtotal: undefined, igv: undefined, motivoCodigo: undefined, items: undefined },
      issuer,
    );
    expect(sinMontos).toContain("S/ 2313.56");
    expect(sinMontos).toContain("06 · Devolución total");
  });

  it("boleta original se rotula como boleta", () => {
    expect(
      buildNotaCreditoHtml({ ...nota, original: "B001-00000003", tipoOriginal: "03" }, issuer),
    ).toContain("Boleta de venta electrónica (03) B001-00000003");
  });
});

describe("imprimirNotaCreditoPdf", () => {
  afterEach(() => jest.restoreAllMocks());

  it("sin emisor avisa y no abre ventana", () => {
    const open = jest.spyOn(window, "open");
    imprimirNotaCreditoPdf(nota, undefined);
    expect(toast.error).toHaveBeenCalledWith(
      "Agrega un RUC emisor en la pestaña Emisores (RUC) para imprimir la nota de crédito",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("con ventana bloqueada avisa", () => {
    jest.spyOn(window, "open").mockReturnValue(null);
    imprimirNotaCreditoPdf(nota, issuer);
    expect(toast.error).toHaveBeenCalledWith(
      "Habilita las ventanas emergentes para imprimir la nota de crédito",
    );
  });

  it("escribe el HTML en la ventana nueva e imprime", () => {
    jest.useFakeTimers();
    const write = jest.fn();
    const print = jest.fn();
    jest.spyOn(window, "open").mockReturnValue({
      document: { write, close: jest.fn() },
      focus: jest.fn(),
      print,
    } as unknown as Window);

    imprimirNotaCreditoPdf(nota, issuer);
    jest.runAllTimers();

    expect(write).toHaveBeenCalledWith(expect.stringContaining("FC01-00000001"));
    expect(print).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
