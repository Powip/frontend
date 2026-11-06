import { screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import { resumenDemoSource } from "@/features/panel-control/resumen/sources/resumen.demo";
import type {
  PanelSource,
  PanelSourceRegistry,
} from "@/features/panel-control/shared/data/panel-source";
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

/** Lo que entrega hoy el backend: sin Gané, sin inventario, sin comparación ni metas. */
const resumenDelBackend: PanelSource<"resumen"> = {
  contractId: "resumen",
  kind: "real",
  descripcion: "Resumen como lo entrega ms-ventas en la Fase A",
  fetch: async (query, context) => {
    const demo = await resumenDemoSource.fetch(query, context);
    const { gane, inventario, ...actual } = demo.actual;
    void gane;
    void inventario;
    return { ...demo, actual, anterior_misma_antiguedad: null, metas: null };
  },
};

const SOURCES: PanelSourceRegistry = {
  ...TEST_SOURCES,
  resumen: resumenDelBackend,
  detalle: detalleDemoSource,
};

describe("Resumen con los datos reales de la Fase A", () => {
  it("no se rompe sin inventario, ganancia, comparación ni metas: dice «Pendiente» en vez de inventar", async () => {
    renderWithPanel(<PanelShell />, { sources: SOURCES });
    await screen.findByRole("region", { name: "Vendí" });
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Vendí" })).getByText(/^S\/ \d/),
      ).toBeVisible(),
    );

    expect(screen.getByText(/Pendiente de integración: falta el stock reservado/)).toBeVisible();

    const gane = screen.getByRole("region", { name: "Gané" });
    expect(within(gane).getByText("—")).toBeVisible();
    expect(within(gane).getByText(/Pendiente: falta la pauta publicitaria/)).toBeVisible();

    // Sin periodo anterior no hay variación ▲▼ en Vendí.
    expect(
      within(screen.getByRole("region", { name: "Vendí" })).queryByRole("button", {
        name: /periodo anterior/i,
      }),
    ).toBeNull();
  });
});
