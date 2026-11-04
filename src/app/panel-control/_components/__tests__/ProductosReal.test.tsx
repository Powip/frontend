import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import { productosDemoSource } from "@/features/panel-control/productos/sources/productos.demo";
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

/** Lo que entrega hoy ms-ventas: el stock vive en otro servicio y siempre llega null. */
const productosDelBackend: PanelSource<"productos"> = {
  contractId: "productos",
  kind: "real",
  descripcion: "Productos como los entrega ms-ventas",
  fetch: async (query, context) => {
    const demo = await productosDemoSource.fetch(query, context);
    return {
      ...demo,
      actual: {
        ...demo.actual,
        productos: demo.actual.productos.map((producto) => ({ ...producto, stock: null })),
      },
    };
  },
};

const SOURCES: PanelSourceRegistry = {
  ...TEST_SOURCES,
  detalle: detalleDemoSource,
  productos: productosDelBackend,
};

describe("Ventas y canales · Productos con los datos reales de la Fase B2", () => {
  it("el stock, que vive en otro servicio, dice «Pendiente» y no un guion sin explicación", async () => {
    renderWithPanel(<PanelShell />, {
      role: "dueno",
      sources: SOURCES,
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "canales", subtab: "productos" } },
    });

    const tabla = await screen.findByRole("table", { name: /Productos/ });
    const columna = within(tabla).getByRole("columnheader", { name: /Stock/ });
    const indice = within(tabla).getAllByRole("columnheader").indexOf(columna);
    const filas = within(tabla).getAllByRole("row").slice(1);

    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) {
      const celdas = within(fila).getAllByRole("cell");
      expect(celdas[indice]).toHaveTextContent("Pendiente");
    }
  });

  it("las líneas vendidas sin costo se informan como señal y no se asume costo 0", async () => {
    const conLineas: PanelSource<"productos"> = {
      ...productosDelBackend,
      fetch: async (query, context) => {
        const base = await productosDelBackend.fetch(query, context);
        return {
          ...base,
          actual: {
            ...base.actual,
            productos: base.actual.productos.map((producto, i) =>
              i === 0
                ? { ...producto, costoUnitario: null, margen: null, lineasSinCosto: 3 }
                : { ...producto, costoUnitario: 10, margen: 0.4, lineasSinCosto: 0 },
            ),
          },
        };
      },
    };
    renderWithPanel(<PanelShell />, {
      role: "dueno",
      sources: { ...SOURCES, productos: conLineas },
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "canales", subtab: "productos" } },
    });
    expect(await screen.findByTitle("Sin costo cargado en 3 líneas vendidas")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Líneas vendidas sin costo: 3");
  });
});
