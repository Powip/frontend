import { DEFAULT_PANEL_STATE, type PanelUiState } from "../../state/panel-state.model";
import { parsePanelUrlState, serializePanelUrlState } from "../panel-url";

describe("panel-url", () => {
  it("serializa y recupera el estado completo", () => {
    const state: PanelUiState = {
      filters: {
        periodo: {
          preset: "personalizado",
          personalizado: { desde: "2026-09-01", hasta: "2026-09-10" },
        },
        tiendaId: "t1",
        canalId: "c1",
        entrada: "lead",
        cobro: "cod",
        zona: "provincia",
        asesorId: "a1",
      },
      navigation: { tab: "operaciones", subtab: "couriers" },
      dataMode: "solo_real",
      preview: { role: "vendedora", asesorId: "a2" },
    };
    expect(parsePanelUrlState(serializePanelUrlState(state))).toEqual(state);
  });

  it("ignora ?turno= de marcadores viejos: conserva el resto de filtros y no crea la clave", () => {
    const parsed = parsePanelUrlState(new URLSearchParams("turno=express&canal=web"));
    expect(parsed.filters.canalId).toBe("web");
    expect(parsed.filters).not.toHaveProperty("turno");
  });

  it("nunca emite turno al serializar", () => {
    const state = {
      ...DEFAULT_PANEL_STATE,
      filters: { ...DEFAULT_PANEL_STATE.filters, turno: "express", canalId: "web" },
    } as unknown as PanelUiState;
    const params = serializePanelUrlState(state);
    expect(params.has("turno")).toBe(false);
    expect(params.get("canal")).toBe("web");
  });

  it("omite valores por defecto", () => {
    expect(serializePanelUrlState(DEFAULT_PANEL_STATE).toString()).toBe("");
  });

  it("descarta valores inválidos", () => {
    const parsed = parsePanelUrlState(
      new URLSearchParams(
        "tab=x&periodo=siglo&entrada=otra&datos=raro&vercomo=jefe&desde=2026-02-30",
      ),
    );
    expect(parsed.navigation.tab).toBeNull();
    expect(parsed.filters.periodo).toEqual({ preset: "mes", personalizado: null });
    expect(parsed.filters.entrada).toBeNull();
    expect(parsed.dataMode).toBe("mixto");
    expect(parsed.preview.role).toBeNull();
  });
});
