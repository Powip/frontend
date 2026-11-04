import type { PanelSource } from "../../data/panel-source";
import { resolvePanelSource } from "../../data/panel-source";
import { DEFAULT_PANEL_SOURCES, sinMetasOcultas } from "../../data/panel-sources";
import type { PanelContractId } from "../../models/panel-contract.model";
import type { PanelSession } from "../../models/panel-session.model";
import { DEFAULT_PANEL_STATE, type PanelUiState } from "../../state/panel-state.model";
import { derivePanelView, type PanelViewReady } from "../../utils/derive-panel-view";
import {
  isAccionOculta,
  isContratoOculto,
  isSubtabOculta,
  metasOcultas,
  PANEL_SECCIONES_OCULTAS,
} from "../panel-entrega.config";
import { METAS_ESPECIFICACION } from "../panel-goals.defaults";
import { PANEL_ROLE_POLICIES } from "../panel-roles.config";
import { PANEL_TABS } from "../panel-tabs.config";
import { contractsForView, VIEW_CONTRACTS } from "../view-contracts.config";

const now = new Date("2026-09-21T21:00:00Z").getTime();
const session = (): PanelSession => ({
  userId: "u",
  userName: "U",
  empresaId: "e",
  tiendas: [],
  rol: { status: "resuelto", role: "dueno", source: "rol_jwt", evidencia: "t" },
});
const nav = (tab: PanelUiState["navigation"]["tab"], subtab: string | null): PanelUiState => ({
  ...DEFAULT_PANEL_STATE,
  navigation: { tab, subtab: subtab as never },
});
function ready(state: PanelUiState): PanelViewReady {
  const v = derivePanelView(state, session(), now);
  if (v.access !== "permitido") throw new Error("acceso");
  return v;
}

describe("entrega: navegación sin lo oculto", () => {
  it("Configuración muestra lo real y deja «Para desarrollo» oculto; Publicidad se ve como Próximamente", () => {
    const config = ready(nav("configuracion", null));
    expect(config.subtabs.map((s) => s.id)).toEqual([
      "canales",
      "metas",
      "costos",
      "estados",
      "cuadres",
    ]);
    expect(config.subtab).toBe("canales");
    expect(config.tabs).toContain("configuracion");
    const canales = ready(nav("canales", null));
    expect(canales.subtabs.map((s) => s.id)).toEqual([
      "canales",
      "productos",
      "publicidad",
      "clientes",
    ]);
  });

  it.each(["desarrollo"])("una URL directa a configuracion/%s cae en Canales", (sub) => {
    const v = ready(nav("configuracion", sub));
    expect(v).toMatchObject({ tab: "configuracion", subtab: "canales" });
  });

  it.each(["metas", "costos", "estados", "cuadres"])(
    "configuracion/%s es una vista real y se abre",
    (sub) => {
      expect(ready(nav("configuracion", sub))).toMatchObject({ subtab: sub });
    },
  );

  it("una pestaña oculta entera cae en el inicio del rol", () => {
    PANEL_SECCIONES_OCULTAS.push({ id: "t", tab: "equipo", contratos: [] });
    try {
      const v = ready(nav("equipo", null));
      expect(v.tab).toBe("resumen");
      expect(v.tabs).not.toContain("equipo");
    } finally {
      PANEL_SECCIONES_OCULTAS.pop();
    }
  });

  it("quitar un ítem de la lista lo vuelve a mostrar", () => {
    const i = PANEL_SECCIONES_OCULTAS.findIndex((s) => s.subtab === "desarrollo");
    const [quitada] = PANEL_SECCIONES_OCULTAS.splice(i, 1);
    try {
      expect(ready(nav("configuracion", "desarrollo")).subtab).toBe("desarrollo");
      expect(isSubtabOculta("configuracion", "desarrollo")).toBe(false);
    } finally {
      PANEL_SECCIONES_OCULTAS.splice(i, 0, quitada);
    }
    expect(isSubtabOculta("configuracion", "desarrollo")).toBe(true);
  });

  it("lista inicial: solo Para desarrollo, Exportar, Compartir y el selector siguen ocultos", () => {
    expect(PANEL_SECCIONES_OCULTAS.map((s) => s.id)).toEqual([
      "Configuración › Para desarrollo",
      "Exportar (Excel completo)",
      "Compartir reporte",
      "Selector Datos: reales + demo",
    ]);
    expect(isAccionOculta("exportar")).toBe(true);
    expect(isAccionOculta("compartir")).toBe(true);
    expect(isSubtabOculta("configuracion", "metas")).toBe(false);
    expect(isSubtabOculta("configuracion", "estados")).toBe(false);
    expect(isSubtabOculta("configuracion", "cuadres")).toBe(false);
    expect(isSubtabOculta("canales", "publicidad")).toBe(false);
    expect(metasOcultas()).toBe(false);
  });
});

describe("entrega: guardián de fuentes demo", () => {
  const demos = Object.entries(DEFAULT_PANEL_SOURCES).flatMap(([id, entrada]) =>
    (Array.isArray(entrada) ? entrada : [entrada]).map((f) => ({
      id: id as PanelContractId,
      kind: (f as PanelSource<PanelContractId>).kind,
    })),
  );

  it("toda fuente demo corresponde a una sección oculta (o es el detalle, verificado abajo)", () => {
    for (const { id, kind } of demos) {
      if (kind !== "demo" || id === "detalle") continue;
      expect({ id, oculto: isContratoOculto(id) }).toEqual({ id, oculto: true });
    }
  });

  it("ninguna vista visible resuelve a una fuente demo (incluye el drawer de detalle)", () => {
    const fallos: string[] = [];
    for (const tab of PANEL_TABS) {
      if (!PANEL_ROLE_POLICIES.dueno.pestanas.includes(tab.id)) continue;
      const v = ready(nav(tab.id, null));
      for (const sub of v.subtabs.length ? v.subtabs.map((s) => s.id) : [null]) {
        const vista = ready(nav(tab.id, sub));
        for (const contrato of contractsForView(tab.id, vista.subtab)) {
          if (isContratoOculto(contrato)) continue;
          const { source } = resolvePanelSource(
            DEFAULT_PANEL_SOURCES,
            contrato,
            "mixto",
            vista.tab,
            vista.subtab,
          );
          if (source?.kind === "demo") fallos.push(`${tab.id}/${vista.subtab}: ${contrato}`);
        }
      }
    }
    // Configuración › Canales no hace drill: su detalle demo es el único que queda.
    // Publicidad es solo el aviso «Próximamente»: no tiene cifras ni drill.
    expect(
      fallos.filter((f) => !f.startsWith("configuracion/") && f !== "canales/publicidad: detalle"),
    ).toEqual([]);
    expect(Object.keys(VIEW_CONTRACTS).length).toBeGreaterThan(0);
  });

  it("el detalle demo solo sirve a pestañas que ningún drill visible usa", () => {
    const usadas = PANEL_TABS.filter((t) => t.id !== "configuracion").map((t) => t.id);
    for (const tab of usadas) {
      const v = ready(nav(tab, null));
      for (const sub of v.subtabs.length ? v.subtabs.map((s) => s.id) : [null]) {
        // Publicidad es solo el aviso «Próximamente»: no tiene cifras, así que no hace drill.
        if (tab === "canales" && sub === "publicidad") continue;
        const { source } = resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "mixto", tab, sub);
        expect({ tab, sub, kind: source?.kind }).toEqual({ tab, sub, kind: "real" });
      }
    }
  });
});

describe("entrega: metas ocultas", () => {
  const fuente = {
    contractId: "resumen",
    kind: "real",
    descripcion: "x",
    fetch: async () => ({
      actual: {},
      anterior_misma_antiguedad: null,
      metas: METAS_ESPECIFICACION,
      generado_en: "x",
    }),
  } as unknown as PanelSource<"resumen">;
  const ctx = {} as never;

  it("anula las metas de cualquier sobre si Metas se vuelve a ocultar (rama de entrega)", async () => {
    PANEL_SECCIONES_OCULTAS.push({
      id: "Configuración › Metas",
      tab: "configuracion",
      subtab: "metas",
      contratos: ["config-metas", "config-metas-guardar"],
    });
    try {
      const r = await sinMetasOcultas(fuente).fetch({} as never, ctx);
      expect((r as { metas: unknown }).metas).toBeNull();
    } finally {
      PANEL_SECCIONES_OCULTAS.pop();
    }
  });

  it("con Metas visible deja pasar las metas del backend en cada sobre", async () => {
    const r = await sinMetasOcultas(fuente).fetch({} as never, ctx);
    expect((r as { metas: unknown }).metas).toEqual(METAS_ESPECIFICACION);
  });
});
