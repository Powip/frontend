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
    expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "resumen", "solo_real").origin.kind).toBe(
      "pendiente",
    );
    expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "detalle", "solo_real").source).toBeNull();
    expect(resolvePanelSource(DEFAULT_PANEL_SOURCES, "resumen", "mixto").origin.kind).toBe("demo");
    expect(
      resolvePanelSource(DEFAULT_PANEL_SOURCES, "canales-fichas", "solo_real").origin.kind,
    ).toBe("real");
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
