import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { mostrarTodasLasSeccionesEnEsteArchivo } from "@/components/panel-control/__tests__/entrega-test-utils";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { callCenterDemoSource } from "@/features/panel-control/call-center/sources/call-center.demo";
import { canalesComparativoDemoSource } from "@/features/panel-control/canales/sources/canales.demo";
import { configMetasDemoSource } from "@/features/panel-control/configuracion/sources/config-metas.demo";
import {
  configCuadresDemoSource,
  configEstadosDemoSource,
} from "@/features/panel-control/configuracion/sources/configuracion.demo";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import {
  equipoConfirmadorasDemoSource,
  equipoVendedorasDemoSource,
} from "@/features/panel-control/equipo/sources/equipo.demo";
import {
  finanzasCajaDemoSource,
  finanzasCobranzaDemoSource,
  finanzasResultadoDemoSource,
} from "@/features/panel-control/finanzas/sources/finanzas.demo";
import { misVentasDemoSource } from "@/features/panel-control/mis-ventas/sources/mis-ventas.demo";
import { publicidadDemoSource } from "@/features/panel-control/publicidad/sources/publicidad.demo";
import { resumenDemoSource } from "@/features/panel-control/resumen/sources/resumen.demo";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import type {
  PanelSubtabId,
  PanelTabId,
} from "@/features/panel-control/shared/models/panel-navigation.model";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

const toastInfo = jest.fn();
const toastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    error: jest.fn(),
  },
}));

const saveAs = jest.fn();
jest.mock("file-saver", () => ({ saveAs: (...args: unknown[]) => saveAs(...args) }));

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

beforeEach(() => {
  toastInfo.mockClear();
  toastSuccess.mockClear();
  saveAs.mockClear();
});

const DEMO: PanelSourceRegistry = {
  ...TEST_SOURCES,
  detalle: detalleDemoSource,
  resumen: resumenDemoSource,
  publicidad: publicidadDemoSource,
  callcenter: callCenterDemoSource,
  "canales-comparativo": canalesComparativoDemoSource,
  "finanzas-resultado": finanzasResultadoDemoSource,
  "finanzas-caja": finanzasCajaDemoSource,
  "finanzas-cobranza": finanzasCobranzaDemoSource,
  "equipo-vendedoras": equipoVendedorasDemoSource,
  "equipo-confirmadoras": equipoConfirmadorasDemoSource,
  "mis-ventas": misVentasDemoSource,
  "config-metas": configMetasDemoSource,
  "config-estados": configEstadosDemoSource,
  "config-cuadres": configCuadresDemoSource,
};

function renderTab(tab: PanelTabId, subtab: PanelSubtabId | null, role: PanelRole = "dueno") {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role,
    sources: DEMO,
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab, subtab } },
  });
  return user;
}

mostrarTodasLasSeccionesEnEsteArchivo();

describe("Finanzas", () => {
  it("Resultado muestra el cuadre del facturado al dinero y el estado de resultados", async () => {
    const user = renderTab("finanzas", "resultado");
    expect(await screen.findByText(/✓ Cuadra/)).toBeInTheDocument();
    const tabla = await screen.findByRole("table", { name: "Estado de resultados" });
    expect(
      within(tabla).getByRole("rowheader", { name: /Publicidad general \(estimada\)/ }),
    ).toBeInTheDocument();
    expect(
      within(tabla).getByRole("rowheader", { name: /Utilidad operativa/ }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("region", { name: "Facturado" })).getByRole("button", {
        name: /ver pedidos/i,
      }),
    );
    expect(await screen.findByRole("dialog", { name: /^Ventas/ })).toBeInTheDocument();
  });

  it("Caja abre los pedidos de una entrada por fecha del dinero", async () => {
    const user = renderTab("finanzas", "caja");
    const tabla = await screen.findByRole("table", { name: "Entradas de caja por fuente" });
    await user.click(
      within(tabla).getByRole("button", { name: /Ver pedidos de Cobro por contraentrega/ }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /Cobro por contraentrega/ });
    expect(within(dialogo).getByText(/Por fecha del dinero/)).toBeInTheDocument();
  });

  it("Cobranza: «Pedir» lleva a Liquidaciones", async () => {
    renderTab("finanzas", "cobranza");
    const tabla = await screen.findByRole("table", {
      name: "Liquidaciones pendientes por courier",
    });
    const enlaces = within(tabla).getAllByRole("link", { name: /^Pedir liquidación a / });
    expect(enlaces[0]).toHaveAttribute("href", "/operaciones/liquidaciones");
    expect(within(tabla).queryByRole("button", { name: /^Pedir/ })).not.toBeInTheDocument();
    expect(toastInfo).not.toHaveBeenCalled();
  });
});

describe("Equipo", () => {
  it("Vendedoras: la fila se despliega, se ordena y el interruptor de upsell cambia el total", async () => {
    const user = renderTab("equipo", "vendedoras");
    const tabla = await screen.findByRole("table", { name: "Vendedoras y caja" });
    const plegable = within(tabla).getAllByRole("button", { expanded: false })[0];
    const filasAntes = within(tabla).getAllByRole("row").length;
    await user.click(plegable);
    expect(plegable).toHaveAttribute("aria-expanded", "true");
    expect(within(tabla).getAllByRole("row").length).toBeGreaterThan(filasAntes);
    await user.click(within(tabla).getByRole("button", { name: /^Pedidos/ }));
    expect(within(tabla).getByRole("columnheader", { name: /^Pedidos/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    const totalCon = screen.getByRole("region", { name: "Total" }).textContent;
    await user.click(screen.getByRole("button", { name: "Sin upsell" }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Total" }).textContent).not.toBe(totalCon),
    );
  });

  it("Confirmadoras abre la entrega de lo confirmado de cada una", async () => {
    const user = renderTab("equipo", "confirmadoras");
    const tabla = await screen.findByRole("table", { name: "Confirmadoras" });
    await user.click(
      within(tabla).getAllByRole("button", { name: /Ver .* entregados confirmados por/ })[0],
    );
    expect(
      await screen.findByRole("dialog", { name: /entregados de lo confirmado/ }),
    ).toBeInTheDocument();
  });
});

describe("Mis ventas", () => {
  it("la Vendedora ve sus cifras y su puesto, sin tarjeta ni texto de comisión", async () => {
    renderTab("misventas", null, "vendedora");
    expect(await screen.findByRole("region", { name: "Vendí" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Pagado" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /comisi/i })).toBeNull();
    expect(screen.queryByText(/comisi/i)).toBeNull();
    expect(
      await screen.findByRole("table", { name: "Mis pedidos aún no cobrados" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Puesto [0-9] de 3\./)).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Ranking de vendedoras por facturación" }).textContent,
    ).toMatch(/\(yo\)/);
  });
});

describe("Mis ventas · sin metas configuradas", () => {
  it("la meta queda «Pendiente» en lugar de inventar un avance", async () => {
    const sinMeta: typeof misVentasDemoSource = {
      ...misVentasDemoSource,
      fetch: async (query, context) => {
        const r = await misVentasDemoSource.fetch(query, context);
        return {
          ...r,
          actual: { ...r.actual, meta: { metaPeriodo: null, avance: null, falta: null } },
        };
      },
    };
    renderWithPanel(<PanelShell />, {
      role: "vendedora",
      sources: { ...DEMO, "mis-ventas": sinMeta },
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "misventas", subtab: null } },
    });
    expect(await screen.findByText("Todavía no hay metas configuradas")).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: /Avance de mi meta/ }),
    ).not.toBeInTheDocument();
  });
});

describe("Configuración", () => {
  it("Metas: editar habilita Guardar y un valor inválido lo bloquea (el guardado real se prueba en ConfigReal)", async () => {
    const user = renderTab("configuracion", "metas");
    const campo = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    expect(campo).toHaveValue("65");
    await user.clear(campo);
    await user.type(campo, "70");
    expect(screen.getByRole("button", { name: /Guardar \(1\)/ })).toBeEnabled();
    await user.clear(campo);
    await user.type(campo, "150");
    expect(screen.getByRole("alert")).toHaveTextContent("Máximo 100 %");
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
  });

  it("Cuadres muestra los 9 cuadres y la calidad abre sus pedidos", async () => {
    const user = renderTab("configuracion", "cuadres");
    const tabla = await screen.findByRole("table", { name: "Cuadres automáticos" });
    expect(within(tabla).getAllByRole("row")).toHaveLength(10);
    await user.click(
      within(screen.getByRole("region", { name: "Ventas con producto sin costo" })).getByRole(
        "button",
        {
          name: /ver pedidos/i,
        },
      ),
    );
    expect(await screen.findByRole("dialog", { name: /productos sin costo/ })).toBeInTheDocument();
  });

  it("Estados abre los pedidos de un estado", async () => {
    const user = renderTab("configuracion", "estados");
    const boton = await screen.findByRole("button", {
      name: /^Rechazado: .* pedidos\. Ver pedidos$/,
    });
    await user.click(boton);
    expect(await screen.findByRole("dialog", { name: /Pedidos en Rechazado/ })).toBeInTheDocument();
  });
});
