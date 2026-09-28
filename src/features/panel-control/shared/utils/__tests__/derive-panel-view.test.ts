import type { PanelSession } from "../../models/panel-session.model";
import { DEFAULT_PANEL_STATE, type PanelUiState } from "../../state/panel-state.model";
import { derivePanelView, type PanelViewReady } from "../derive-panel-view";

const now = new Date("2026-09-21T21:00:00Z").getTime();

function session(
  role: "dueno" | "supervisora" | "confirmadora" | "vendedora" | null,
): PanelSession {
  return {
    userId: "user-1",
    userName: "Usuaria",
    empresaId: "empresa-1",
    tiendas: [{ id: "t1", nombre: "Tienda 1" }],
    rol: role
      ? { status: "resuelto", role, source: "rol_jwt", evidencia: "test" }
      : { status: "sin_resolver", rolJwt: "OPERACIONES", motivo: "sin evidencia" },
  };
}

function ready(state: PanelUiState, role: Parameters<typeof session>[0]): PanelViewReady {
  const view = derivePanelView(state, session(role), now);
  if (view.access !== "permitido") throw new Error("Se esperaba acceso permitido");
  return view;
}

const withFilters = (partial: Partial<PanelUiState["filters"]>): PanelUiState => ({
  ...DEFAULT_PANEL_STATE,
  filters: { ...DEFAULT_PANEL_STATE.filters, ...partial },
});

describe("derivePanelView", () => {
  it("bloquea roles sin resolver", () => {
    expect(derivePanelView(DEFAULT_PANEL_STATE, session(null), now)).toMatchObject({
      access: "sin_rol",
    });
  });

  it("aplica pestañas e inicio por rol", () => {
    expect(ready(DEFAULT_PANEL_STATE, "dueno")).toMatchObject({ tab: "resumen" });
    expect(ready(DEFAULT_PANEL_STATE, "supervisora").tab).toBe("operaciones");
    expect(ready(DEFAULT_PANEL_STATE, "confirmadora").tabs).toEqual(["callcenter"]);
    expect(ready(DEFAULT_PANEL_STATE, "vendedora").tabs).toEqual(["misventas"]);
  });

  it("no permite navegar a Finanzas sin permiso", () => {
    const state = {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab: "finanzas" as const, subtab: null },
    };
    expect(ready(state, "supervisora").tab).toBe("operaciones");
    expect(ready(state, "dueno").tab).toBe("finanzas");
  });

  it("solo el Dueño tiene permiso de costos", () => {
    expect(ready(DEFAULT_PANEL_STATE, "dueno").capabilities.has("ver_costos")).toBe(true);
    for (const role of ["supervisora", "confirmadora", "vendedora"] as const) {
      expect(ready(DEFAULT_PANEL_STATE, role).capabilities.has("ver_costos")).toBe(false);
    }
  });

  it("fija la asesora en el usuario para Confirmadora y Vendedora", () => {
    const state = withFilters({ asesorId: "otra" });
    const view = ready(state, "vendedora");
    expect(view.asesorFijo).toBe("user-1");
    expect(view.query.asesor).toBe("user-1");
  });

  it("la previsualización del Dueño exige elegir asesora y se informa como ver_como", () => {
    const previa = {
      ...DEFAULT_PANEL_STATE,
      preview: { role: "confirmadora" as const, asesorId: null },
    };
    const sinAsesora = ready(previa, "dueno");
    expect(sinAsesora.role).toBe("confirmadora");
    expect(sinAsesora.requiereAsesorPreview).toBe(true);
    expect(sinAsesora.actualCapabilities.has("ver_costos")).toBe(true);
    expect(sinAsesora.capabilities.has("ver_costos")).toBe(false);

    const conAsesora = ready(
      { ...previa, preview: { role: "confirmadora", asesorId: "a-9" } },
      "dueno",
    );
    expect(conAsesora.query).toMatchObject({ asesor: "a-9", ver_como: "confirmadora" });
  });

  it("un rol sin ver_como no puede previsualizar", () => {
    const state = { ...DEFAULT_PANEL_STATE, preview: { role: "dueno" as const, asesorId: null } };
    expect(ready(state, "supervisora").role).toBe("supervisora");
  });

  it("construye la consulta con los filtros activos y el periodo en hora Lima", () => {
    const view = ready(withFilters({ tiendaId: "t1", canalId: "c1", zona: "lima" }), "dueno");
    expect(view.query).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-21",
      anterior_desde: "2026-08-01",
      anterior_hasta: "2026-08-21",
      zona_horaria: "America/Lima",
      tienda: "t1",
      canal: "c1",
      zona: "lima",
    });
  });

  it("elige la primera subpestaña válida", () => {
    const state = {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab: "operaciones" as const, subtab: "caja" as const },
    };
    expect(ready(state, "dueno").subtab).toBe("cola");
  });
});
