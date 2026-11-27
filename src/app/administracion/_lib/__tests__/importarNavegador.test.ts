import { armarImportacion, guardarRespaldoLocal } from "../importarNavegador";

const C = "c1";
const poner = (clave: string, valor: unknown) => window.localStorage.setItem(clave, JSON.stringify(valor));

beforeEach(() => window.localStorage.clear());

describe("armarImportacion", () => {
  it("sin nada guardado en este navegador no hay nada que subir", () => {
    poner("powip:admin:metas:otra:2026", { ventasAnual: 1, profitAnual: null, margenObjetivoPct: null });
    poner("powip:admin:pauta:c1", [{ id: "p", canalId: "x", fecha: "2026-11-01", monto: 10, lineas: [] }]);
    const r = armarImportacion(window.localStorage, C);
    expect(r.hayDatos).toBe(false);
    expect(r.claves).toEqual([]);
  });

  it("metas por año, sin los valores por defecto viejos ni años vacíos", () => {
    poner("powip:admin:metas:c1:2026", { ventasAnual: 500000, profitAnual: 85000, margenObjetivoPct: 20 });
    poner("powip:admin:metas:c1:2025", { ventasAnual: 300000, profitAnual: null, margenObjetivoPct: 15 });
    poner("powip:admin:metas:c1:2024", { ventasAnual: null, profitAnual: null, margenObjetivoPct: null });
    poner("powip:admin:metas:c1:abc", { ventasAnual: 1 });
    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.metas).toEqual([{ anio: 2025, ventasAnual: 300000, profitAnual: null, margenObjetivoPct: 15 }]);
    expect(r.claves.sort()).toEqual([
      "powip:admin:metas:c1:2024",
      "powip:admin:metas:c1:2025",
      "powip:admin:metas:c1:2026",
    ]);
  });

  it("objetivos: el diario; si solo hay meta mensual vieja, ÷ 30", () => {
    poner("powip:admin:objetivo-canal:c1:WHATSAPP", { ventasDia: 800 });
    poner("powip:admin:objetivo-canal:c1:todos", { objetivoCpv: 1, presupuestoMes: 0, metaVentasMes: 4500 });
    poner("powip:admin:objetivo-canal:c1:WEB", { objetivoCpv: 3 });
    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.objetivos).toEqual(
      expect.arrayContaining([
        { canal: "WHATSAPP", ventasDia: 800 },
        { canal: "todos", ventasDia: 150 },
      ]),
    );
    expect(r.datos.objetivos).toHaveLength(2);
  });

  it("capital: tipo del servidor, préstamo con sus cuotas pagadas (sin pasar el plazo) y fecha válida", () => {
    poner("powip:admin:capital:c1", [
      { id: "a", tipo: "Capital propio", descripcion: "Inicial", monto: 5000, tienda: "Lima" },
      {
        id: "b",
        tipo: "Préstamo",
        descripcion: "BCP",
        monto: 10000,
        tienda: "",
        tasaAnualPct: 12.68,
        plazoCuotas: 12,
        cuotaMensual: 888.49,
        fechaInicio: "2026-11-01",
      },
      { id: "c", tipo: "Préstamo", descripcion: "Caja", monto: 2000, tienda: "", plazoCuotas: 3, fechaInicio: "ayer" },
      { id: "d", tipo: "Aumento de capital", descripcion: "Cero", monto: 0, tienda: "" },
    ]);
    poner("powip:admin:capital-cuotas-pagadas:c1:b", 4);
    poner("powip:admin:capital-cuotas-pagadas:c1:c", 9);
    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.capital).toEqual([
      { tipo: "capital_propio", descripcion: "Inicial", monto: 5000, tienda: "Lima" },
      {
        tipo: "prestamo",
        descripcion: "BCP",
        monto: 10000,
        tienda: null,
        teaPct: 12.68,
        plazoCuotas: 12,
        cuotaMensual: 888.49,
        fechaInicio: "2026-11-01",
        cuotasPagadas: 4,
      },
      {
        tipo: "prestamo",
        descripcion: "Caja",
        monto: 2000,
        tienda: null,
        teaPct: null,
        plazoCuotas: 3,
        cuotaMensual: null,
        fechaInicio: null,
        cuotasPagadas: 3,
      },
    ]);
    expect(r.claves).toEqual(
      expect.arrayContaining([
        "powip:admin:capital:c1",
        "powip:admin:capital-cuotas-pagadas:c1:b",
        "powip:admin:capital-cuotas-pagadas:c1:c",
      ]),
    );
  });

  it("cuentas: pendientes con el vencimiento de texto en la descripción, y el historial como saldadas", () => {
    poner("powip:admin:cuentas-cobrar:c1", [
      { id: "1", concepto: "Cliente Ana", descripcion: "Pedido 12", monto: 300, vencimiento: "A fin de mes" },
    ]);
    poner("powip:admin:cuentas-pagar:c1", [{ id: "2", concepto: "", descripcion: "", monto: 150, vencimiento: "" }]);
    poner("powip:admin:cuentas-historial:c1", [
      { id: "3", mes: "2026-10", tipo: "egreso", concepto: "Proveedor", monto: 90 },
      { id: "4", mes: "mal", tipo: "ingreso", concepto: "X", monto: 10 },
    ]);
    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.cuentas).toEqual([
      { lado: "cobrar", concepto: "Cliente Ana", descripcion: "Pedido 12 · Vence: A fin de mes", monto: 300, vence: null, saldadaEn: null },
      { lado: "pagar", concepto: "Sin concepto", descripcion: "", monto: 150, vence: null, saldadaEn: null },
      { lado: "pagar", concepto: "Proveedor", descripcion: "", monto: 90, vence: null, saldadaEn: "2026-10-01" },
    ]);
    expect(r.hayDatos).toBe(true);
  });

  it("limpia lo que el servidor rechazaría (un solo dato malo frenaría toda la importación)", () => {
    poner("powip:admin:metas:c1:2026", { ventasAnual: 333333.3333, profitAnual: 2e15, margenObjetivoPct: 150 });
    poner("powip:admin:objetivo-canal:c1:Tienda Física", { ventasDia: 120.456 });
    poner("powip:admin:objetivo-canal:c1:Web Shop", { ventasDia: 50.555 });
    poner("powip:admin:objetivo-canal:c1:TIENDA_FISICA", { ventasDia: 999 });
    poner(`powip:admin:objetivo-canal:c1:${"X".repeat(70)}`, { ventasDia: 10 });
    poner("powip:admin:capital:c1", [
      {
        id: "b",
        tipo: "Préstamo",
        descripcion: "BCP",
        monto: 1000.555,
        tienda: "",
        tasaAnualPct: 12.682512,
        plazoCuotas: 12,
        cuotaMensual: 88.8888,
        fechaInicio: "2026-02-30",
      },
      { id: "g", tipo: "Capital propio", descripcion: "Gigante", monto: 5e12, tienda: "" },
    ]);
    poner("powip:admin:cuentas-historial:c1", [{ id: "1", mes: "2026-13", tipo: "egreso", concepto: "X", monto: 10 }]);

    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.metas).toEqual([{ anio: 2026, ventasAnual: 333333.33, profitAnual: null, margenObjetivoPct: null }]);
    // Dos claves del mismo canal: gana la ya normalizada (la que usaba la versión más nueva).
    expect(r.datos.objetivos).toEqual(
      expect.arrayContaining([
        { canal: "TIENDA_FISICA", ventasDia: 999 },
        { canal: "WEB_SHOP", ventasDia: 50.56 },
      ]),
    );
    expect(r.datos.objetivos).toHaveLength(2);
    expect(r.datos.capital).toEqual([
      {
        tipo: "prestamo",
        descripcion: "BCP",
        monto: 1000.56,
        tienda: null,
        teaPct: 12.6825,
        plazoCuotas: 12,
        cuotaMensual: 88.89,
        fechaInicio: null,
        cuotasPagadas: 0,
      },
    ]);
    expect(r.datos.cuentas).toEqual([]);
  });

  it("JSON roto en una clave no frena el resto", () => {
    window.localStorage.setItem("powip:admin:capital:c1", "{roto");
    poner("powip:admin:metas:c1:2026", { ventasAnual: 1000, profitAnual: null, margenObjetivoPct: null });
    const r = armarImportacion(window.localStorage, C);
    expect(r.datos.capital).toEqual([]);
    expect(r.datos.metas).toHaveLength(1);
  });
});

describe("guardarRespaldoLocal", () => {
  it("mueve cada clave a powip:admin:respaldo:* (no se pierde nada) y deja de ofrecer la importación", () => {
    poner("powip:admin:metas:c1:2026", { ventasAnual: 1000, profitAnual: null, margenObjetivoPct: null });
    const { claves } = armarImportacion(window.localStorage, C);
    guardarRespaldoLocal(window.localStorage, claves);
    expect(window.localStorage.getItem("powip:admin:metas:c1:2026")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("powip:admin:respaldo:metas:c1:2026") ?? "null")).toEqual({
      ventasAnual: 1000,
      profitAnual: null,
      margenObjetivoPct: null,
    });
    expect(armarImportacion(window.localStorage, C).hayDatos).toBe(false);
  });
});
