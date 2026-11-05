import { toCanalFicha } from "../../../canales/mappers/to-canal-ficha.mapper";
import { PANEL_CONTRACT_IDS } from "../../models/panel-contract.model";
import { PANEL_CONTRACTS } from "../panel-contracts";
import { resolvePanelSource } from "../panel-source";
import { DEFAULT_PANEL_SOURCES } from "../panel-sources";

describe("registro de fuentes", () => {
  it("todo contrato tiene descriptor con endpoint", () => {
    for (const id of PANEL_CONTRACT_IDS) {
      expect(PANEL_CONTRACTS[id].id).toBe(id);
      expect(PANEL_CONTRACTS[id].endpoint).not.toHaveLength(0);
    }
  });

  it("marca como pendiente un contrato sin fuente", () => {
    expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "acciones-pedido", "mixto")).toMatchObject({
      source: null,
      origin: { kind: "pendiente" },
    });
  });

  it("oculta las fuentes demo en modo solo reales y mantiene las reales", () => {
    // Exportar y Compartir ya son reales: siguen disponibles en «Solo datos reales».
    for (const id of ["exportacion-libro", "compartir-reporte"] as const) {
      expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, id, "solo_real")).toMatchObject({
        source: { kind: "real" },
        origin: { kind: "real" },
      });
    }
    // Publicidad ya no tiene fuente demo: es el aviso «Próximamente», sin cifras.
    expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "publicidad", "mixto")).toMatchObject({
      source: null,
      origin: { kind: "pendiente" },
    });
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "canales-fichas", "solo_real").origin.kind,
    ).toBe("real");
  });

  it("estado y resumen ya se leen del backend (ms-ventas) y no se ocultan en solo reales", () => {
    for (const id of ["estado-periodo", "resumen"] as const) {
      expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, id, "solo_real", "resumen")).toMatchObject({
        source: { kind: "real" },
        origin: { kind: "real" },
      });
    }
  });

  it("call center y su detalle ya se leen del backend, también en solo reales", () => {
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "callcenter", "solo_real", "callcenter"),
    ).toMatchObject({
      source: { kind: "real" },
      origin: { kind: "real" },
    });
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "solo_real", "callcenter"),
    ).toMatchObject({ source: { kind: "real" } });
  });

  it("Operaciones (cola, couriers, inventario) y su detalle ya se leen del backend, también en solo reales", () => {
    for (const modo of ["mixto", "solo_real"] as const) {
      for (const [id, subtab] of [
        ["operaciones-cola", "cola"],
        ["operaciones-couriers", "couriers"],
        ["operaciones-inventario", "inventario"],
      ] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, id, modo, "operaciones", subtab),
        ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
      }
      expect(
        resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "operaciones", "cola"),
      ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
    }
  });

  it("Operaciones apunta a GET /panel/operaciones?sub=… en el origen que se muestra", () => {
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "operaciones-inventario", "mixto", "operaciones")
        .origin.endpoint,
    ).toContain("/panel/operaciones?sub=inventario (ms-ventas)");
  });

  it("Finanzas (resultado, caja, cobranza) y su detalle ya se leen del backend, también en solo reales", () => {
    for (const modo of ["mixto", "solo_real"] as const) {
      for (const [id, subtab] of [
        ["finanzas-resultado", "resultado"],
        ["finanzas-caja", "caja"],
        ["finanzas-cobranza", "cobranza"],
      ] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, id, modo, "finanzas", subtab),
        ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
      }
      expect(
        resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "finanzas", "caja"),
      ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
    }
  });

  it("Finanzas apunta a GET /panel/finanzas?reloj=… en el origen que se muestra", () => {
    for (const [id, reloj] of [
      ["finanzas-resultado", "pedido"],
      ["finanzas-caja", "caja"],
      ["finanzas-cobranza", "cobranza"],
    ] as const) {
      expect(
        resolvePanelSource(DEFAULT_PANEL_SOURCES, id, "mixto", "finanzas").origin.endpoint,
      ).toContain(`/panel/finanzas?reloj=${reloj} (ms-ventas)`);
    }
  });

  it("el comparativo y el detalle de canal ya se leen del backend, también en solo reales", () => {
    for (const id of ["canales-comparativo", "canales-detalle"] as const) {
      expect(
        resolvePanelSource(DEFAULT_PANEL_SOURCES, id, "solo_real", "canales", "canales"),
      ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
    }
  });

  it("productos y clientes ya se leen del backend, también en solo reales", () => {
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "productos", "solo_real", "canales", "productos"),
    ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
    expect(
      resolvePanelSource(
        DEFAULT_PANEL_SOURCES,
        "clientes-zonas",
        "solo_real",
        "canales",
        "clientes",
      ),
    ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
  });

  describe("el detalle de pedidos sigue a la pestaña que lo abre", () => {
    it("en el Resumen lee del backend, también en solo reales", () => {
      for (const modo of ["mixto", "solo_real"] as const) {
        expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "resumen")).toMatchObject(
          { source: { kind: "real" }, origin: { kind: "real" } },
        );
      }
    });

    it("en una pestaña aún demo nunca muestra pedidos reales detrás de una cifra demo", () => {
      for (const pestana of ["canales"] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "mixto", pestana),
        ).toMatchObject({ source: { kind: "demo" }, origin: { kind: "demo" } });
        // En «Solo datos reales» esa vista queda pendiente, como el resto de lo demo.
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "solo_real", pestana),
        ).toMatchObject({ source: null, origin: { kind: "pendiente" } });
      }
    });

    it("en Ventas y canales solo la subpestaña Canales lee del backend", () => {
      for (const modo of ["mixto", "solo_real"] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "canales", "canales"),
        ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
      }
    });

    it("en Ventas y canales la subpestaña Productos también lee del backend", () => {
      for (const modo of ["mixto", "solo_real"] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "canales", "productos"),
        ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
      }
    });

    it("en Ventas y canales la subpestaña Clientes también lee del backend", () => {
      for (const modo of ["mixto", "solo_real"] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", modo, "canales", "clientes"),
        ).toMatchObject({ source: { kind: "real" }, origin: { kind: "real" } });
      }
    });

    it("Publicidad, la única subpestaña sin backend, sigue en demo", () => {
      for (const subpestana of ["publicidad"] as const) {
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "mixto", "canales", subpestana),
        ).toMatchObject({ source: { kind: "demo" } });
        expect(
          resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "solo_real", "canales", subpestana),
        ).toMatchObject({ source: null, origin: { kind: "pendiente" } });
      }
    });

    it("sin pestaña (tabla de desarrollo) informa la fuente real", () => {
      expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "mixto").origin.kind).toBe(
        "real",
      );
    });
  });
});

describe("toCanalFicha", () => {
  it("mapea solo lo comprobable y marca el resto como pendiente", () => {
    const lead = toCanalFicha({
      id: "c1",
      empresaId: "e1",
      canalNombre: "shopify",
      canalLabel: "Shopify COD",
      flujoEntrada: "call_center_cod",
      requiereConfirmacionCc: true,
      activo: true,
      datosRequeridos: [],
    });
    expect(lead).toMatchObject({ nombre: "Shopify COD", entrada: "lead", cobro: null });
    expect(lead.camposPendientes).toContain("cobro");

    const directo = toCanalFicha({
      id: "c2",
      empresaId: "e1",
      canalNombre: "whatsapp",
      canalLabel: "",
      flujoEntrada: "directo_operaciones",
      requiereConfirmacionCc: false,
      activo: false,
      datosRequeridos: [],
    });
    expect(directo).toMatchObject({ nombre: "whatsapp", entrada: null, activo: false });
    expect(directo.camposPendientes).toContain("entrada");
  });
});
