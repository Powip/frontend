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
        turno: "express",
        asesorId: "a1",
      },
      navigation: { tab: "operaciones", subtab: "couriers" },
      dataMode: "solo_real",
      preview: { role: "vendedora", asesorId: "a2" },
    };
    expect(parsePanelUrlState(serializePanelUrlState(state))).toEqual(state);
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
