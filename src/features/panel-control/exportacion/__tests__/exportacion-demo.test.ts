import * as XLSX from "xlsx";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import { contexto, MES } from "../../shared/data/demo/__tests__/demo-contexto";
import { HOJAS_LIBRO_COMPLETO } from "../models/exportacion.model";
import {
  compartirReporteDemoSource,
  construirHojasLibro,
  exportacionLibroDemoSource,
} from "../sources/exportacion.demo";

async function leerLibro(role: "dueno" | "supervisora") {
  const { archivo, nombreArchivo } = await exportacionLibroDemoSource.fetch(
    { ...MES, formato: "xlsx" },
    contexto(role),
  );
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as ArrayBuffer);
    lector.onerror = () => reject(lector.error);
    lector.readAsArrayBuffer(archivo);
  });
  return { libro: XLSX.read(buffer, { type: "array" }), nombreArchivo };
}

describe("Excel completo", () => {
  it("trae las 9 hojas en orden, con cabecera DEMO y nombre sin tildes", async () => {
    const { libro, nombreArchivo } = await leerLibro("dueno");
    expect(libro.SheetNames).toEqual([...HOJAS_LIBRO_COMPLETO]);
    expect(nombreArchivo).toBe("powip_panel_2026-09-01_2026-09-21_DEMO.xlsx");
    const resumen = libro.Sheets.Resumen;
    expect(resumen.A1.v).toBe("POWIP · Panel de Control");
    expect(String(resumen.B6.v)).toMatch(/^DATOS DEMO/);
    expect(resumen.B4.v).toBe("Sin filtros");
  });

  it("Pedidos tiene 27 columnas para el Dueño, una fila por pedido y montos numéricos", async () => {
    const hojas = await construirHojasLibro(MES, contexto());
    const pedidos = hojas.find((hoja) => hoja.nombre === "Pedidos");
    expect(pedidos?.columnas).toHaveLength(27);
    const { libro } = await leerLibro("dueno");
    const hoja = libro.Sheets.Pedidos;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1 });
    expect(filas.length - 8).toBe(pedidos?.filas.length);
    const neto = filas[8][22];
    expect(typeof neto).toBe("number");
  });

  it("la Supervisora no recibe columnas de costo, flete, margen, ganancia ni comisión", async () => {
    const hojas = await construirHojasLibro(MES, contexto("supervisora"));
    const encabezados = hojas.flatMap((hoja) => hoja.columnas.map(([nombre]) => nombre));
    expect(hojas.find((hoja) => hoja.nombre === "Pedidos")?.columnas).toHaveLength(25);
    for (const prohibido of [/costo/i, /flete/i, /margen/i, /comisi/i]) {
      expect(encabezados.some((nombre) => prohibido.test(nombre))).toBe(false);
    }
    const resumen = hojas.find((hoja) => hoja.nombre === "Resumen");
    expect(resumen?.filas.some((fila) => fila[0] === "Ganancia")).toBe(false);
  });

  it("la Confirmadora no puede descargarlo", async () => {
    await expect(
      exportacionLibroDemoSource.fetch({ ...MES, formato: "xlsx" }, contexto("confirmadora", "a1")),
    ).rejects.toThrow("403");
  });
});

describe("Compartir reporte", () => {
  it("usa las mismas cifras del panel y el formato de WhatsApp", async () => {
    const reporte = await compartirReporteDemoSource.fetch(MES, contexto());
    const { actual } = await resumenDemoSource.fetch(MES, contexto());
    expect(reporte.ventaTotal).toBe(actual.vendi.facturacion);
    expect(reporte.gananciaSobreEntregado).toBe(actual.gane?.ganancia);
    expect(reporte.gananciaSobreVentaTotal).toBeCloseTo(
      reporte.ventaTotal -
        (reporte.producto ?? 0) -
        (reporte.publicidad ?? 0) -
        (reporte.envios ?? 0),
      6,
    );
    expect(reporte.texto).toMatch(/^\*Reporte POWIP · 1 set – 21 set \(hora Lima\)\*/);
    expect(reporte.texto).toMatch(/Venta total: S\/ /);
    expect(reporte.texto).toMatch(/CPA: S\/ /);
    expect(reporte.texto).toMatch(/Cifras de demostración/);
  });

  it("la Supervisora no recibe producto, envíos ni ganancias", async () => {
    const reporte = await compartirReporteDemoSource.fetch(MES, contexto("supervisora"));
    for (const campo of [
      "producto",
      "envios",
      "gananciaSobreVentaTotal",
      "gananciaSobreEntregado",
    ]) {
      expect(campo in reporte).toBe(false);
    }
    expect(reporte.texto).not.toMatch(/Ganancia|Producto|Envíos/);
  });
});
