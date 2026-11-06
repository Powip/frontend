import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import type { CanalGananciaFila } from "@/features/panel-control/canales/models/canales-comparativo.model";
import {
  canalesComparativoDemoSource,
  canalesDetalleDemoSource,
} from "@/features/panel-control/canales/sources/canales.demo";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import type {
  PanelSource,
  PanelSourceRegistry,
} from "@/features/panel-control/shared/data/panel-source";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

jest.mock("sonner", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

/** Lo que entrega hoy ms-ventas en la vista de ganancia: lo facturado y entregado, y el resto sin dato. */
const sinDato = <T extends CanalGananciaFila | Omit<CanalGananciaFila, "canalId">>(fila: T): T => ({
  ...fila,
  costoProducto: null,
  costoIncompleto: true,
  pautaDirecta: null,
  pautaGeneralEstimada: null,
  comision: null,
  flete: null,
  ganancia: null,
  gananciaParcial: true,
  margen: null,
  retornoPublicidad: null,
  costoPorVenta: null,
});

const comparativoDelBackend: PanelSource<"canales-comparativo"> = {
  contractId: "canales-comparativo",
  kind: "real",
  descripcion: "Comparativo como lo entrega ms-ventas",
  fetch: async (query, context) => {
    const demo = await canalesComparativoDemoSource.fetch(query, context);
    if (demo.actual.vista !== "ganancia") return demo;
    return {
      ...demo,
      actual: {
        ...demo.actual,
        filas: demo.actual.filas.map(sinDato),
        total: sinDato(demo.actual.total),
      },
    };
  },
};

const SOURCES: PanelSourceRegistry = {
  ...TEST_SOURCES,
  detalle: detalleDemoSource,
  "canales-comparativo": comparativoDelBackend,
  "canales-detalle": canalesDetalleDemoSource,
};

describe("Ventas y canales con los datos reales de la Fase B1", () => {
  it("la ganancia sin costo, pauta ni comisión dice «Pendiente» y lo explica, sin mostrar «≤ —»", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, {
      role: "dueno",
      sources: SOURCES,
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "canales", subtab: "canales" } },
    });

    await user.click(await screen.findByRole("button", { name: "Ganancia" }));
    const tabla = await screen.findByRole("table", { name: "Comparativo de canales · ganancia" });

    expect(within(tabla).getAllByText("Pendiente").length).toBeGreaterThan(1);
    expect(within(tabla).queryByText(/≤/)).toBeNull();
    expect(
      screen.getByText(/La ganancia está pendiente: todavía no se registran el costo/),
    ).toBeVisible();
    // La nota de «tope» del comparativo no aplica cuando no hay ganancia que acotar.
    expect(screen.queryByText(/«≤» indica que la ganancia es un tope/)).toBeNull();
  });
});
