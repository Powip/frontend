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
  it("Configuración queda solo con Canales y Ventas y canales sin Publicidad", () => {
    const config = ready(nav("configuracion", null));
    expect(config.subtabs.map((s) => s.id)).toEqual(["canales"]);
    expect(config.subtab).toBe("canales");
    expect(config.tabs).toContain("configuracion");
    const canales = ready(nav("canales", null));
    expect(canales.subtabs.map((s) => s.id)).toEqual(["canales", "productos", "clientes"]);
  });

  it.each(["metas", "estados", "cuadres", "desarrollo"])(
    "una URL directa a configuracion/%s cae en Canales",
    (sub) => {
      const v = ready(nav("configuracion", sub));
      expect(v).toMatchObject({ tab: "configuracion", subtab: "canales" });
    },
  );

  it("una URL directa a canales/publicidad cae en una subpestaña visible", () => {
    const v = ready(nav("canales", "publicidad"));
    expect(v.subtab).toBe("canales");
  });

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
    const i = PANEL_SECCIONES_OCULTAS.findIndex((s) => s.subtab === "publicidad");
    const [quitada] = PANEL_SECCIONES_OCULTAS.splice(i, 1);
    try {
      expect(ready(nav("canales", "publicidad")).subtab).toBe("publicidad");
      expect(isSubtabOculta("canales", "publicidad")).toBe(false);
    } finally {
      PANEL_SECCIONES_OCULTAS.splice(i, 0, quitada);
    }
    expect(isSubtabOculta("canales", "publicidad")).toBe(true);
  });

  it("lista inicial: acciones y metas ocultas", () => {
    expect(isAccionOculta("exportar")).toBe(true);
    expect(isAccionOculta("compartir")).toBe(true);
    expect(metasOcultas()).toBe(true);
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
    expect(fallos.filter((f) => !f.startsWith("configuracion/"))).toEqual([]);
    expect(Object.keys(VIEW_CONTRACTS).length).toBeGreaterThan(0);
  });

  it("el detalle demo solo sirve a pestañas que ningún drill visible usa", () => {
    const usadas = PANEL_TABS.filter((t) => t.id !== "configuracion").map((t) => t.id);
    for (const tab of usadas) {
      const v = ready(nav(tab, null));
      for (const sub of v.subtabs.length ? v.subtabs.map((s) => s.id) : [null]) {
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

  it("anula las metas de cualquier sobre mientras Metas esté oculta", async () => {
    const r = await sinMetasOcultas(fuente).fetch({} as never, ctx);
    expect((r as { metas: unknown }).metas).toBeNull();
  });

  it("deja pasar las metas si Metas vuelve a mostrarse", async () => {
    const quitadas = PANEL_SECCIONES_OCULTAS.filter((s) => s.contratos.includes("config-metas"));
    const indices = quitadas.map((q) => PANEL_SECCIONES_OCULTAS.indexOf(q));
    for (const q of quitadas) PANEL_SECCIONES_OCULTAS.splice(PANEL_SECCIONES_OCULTAS.indexOf(q), 1);
    try {
      const r = await sinMetasOcultas(fuente).fetch({} as never, ctx);
      expect((r as { metas: unknown }).metas).toEqual(METAS_ESPECIFICACION);
    } finally {
      for (const [n, q] of quitadas.entries()) PANEL_SECCIONES_OCULTAS.splice(indices[n], 0, q);
    }
  });
});
