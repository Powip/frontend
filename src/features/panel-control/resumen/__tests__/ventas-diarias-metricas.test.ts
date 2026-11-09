import type { VentaDiaria } from "../models/resumen.model";
import {
  descripcionDia,
  METRICAS_VENTA_DIARIA,
  totalesDelPeriodo,
  valorDeMetrica,
} from "../utils/ventas-diarias-metricas";

const dia = (over: Partial<VentaDiaria> = {}): VentaDiaria => ({
  dia: "2026-11-05",
  facturacion: 1000,
  ventas: 4,
  unidades: 10,
  diaAnterior: null,
  facturacionAnterior: null,
  ...over,
});

describe("métricas de «Ventas diarias»", () => {
  it("ofrece Facturación, Pedidos, Unidades y Ticket promedio, en ese orden", () => {
    expect(METRICAS_VENTA_DIARIA.map((m) => m.etiqueta)).toEqual([
      "Facturación",
      "Pedidos",
      "Unidades",
      "Ticket promedio",
    ]);
  });

  it("el valor de cada métrica sale del día, y el ticket es facturación ÷ pedidos", () => {
    const d = dia();
    expect(valorDeMetrica(d, "facturacion")).toBe(1000);
    expect(valorDeMetrica(d, "pedidos")).toBe(4);
    expect(valorDeMetrica(d, "unidades")).toBe(10);
    expect(valorDeMetrica(d, "ticket")).toBe(250);
  });

  it("un día sin ventas no inventa un ticket: la barra vale 0 y el texto no muestra una cifra", () => {
    const vacio = dia({ facturacion: 0, ventas: 0, unidades: 0 });
    expect(valorDeMetrica(vacio, "ticket")).toBe(0);
    const texto = descripcionDia(vacio);
    expect(texto).toContain("0 ventas");
    expect(texto).toContain("0 unidades");
    expect(texto).toContain("ticket —");
  });

  it("la descripción de cada barra trae las cuatro cifras del día", () => {
    const texto = descripcionDia(dia());
    expect(texto).toContain("5 nov");
    expect(texto).toContain("4 ventas");
    expect(texto).toContain("10 unidades");
    expect(texto).toMatch(/ticket S\/ 250/);
    expect(texto).toMatch(/S\/ 1.?000/);
  });

  it("con comparación agrega la facturación del periodo anterior", () => {
    const texto = descripcionDia(
      dia({ diaAnterior: "2026-10-29", facturacionAnterior: 800 }),
      true,
    );
    expect(texto).toContain("periodo anterior (29 oct)");
    expect(
      descripcionDia(dia({ diaAnterior: "2026-10-29", facturacionAnterior: 800 })),
    ).not.toContain("periodo anterior");
  });

  it("el total del periodo calcula el ticket con los totales, no promediando los días", () => {
    const totales = totalesDelPeriodo([
      dia({ facturacion: 1000, ventas: 1, unidades: 2 }),
      dia({ dia: "2026-11-06", facturacion: 300, ventas: 3, unidades: 5 }),
      dia({ dia: "2026-11-07", facturacion: 0, ventas: 0, unidades: 0 }),
    ]);
    expect(totales).toEqual({ facturacion: 1300, ventas: 4, unidades: 7, ticket: 325 });
    expect(totalesDelPeriodo([]).ticket).toBeNull();
  });
});
