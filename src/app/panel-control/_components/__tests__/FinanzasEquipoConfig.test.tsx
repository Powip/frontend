import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
  compartirReporteDemoSource,
  exportacionLibroDemoSource,
} from "@/features/panel-control/exportacion/sources/exportacion.demo";
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
  "exportacion-libro": exportacionLibroDemoSource,
  "compartir-reporte": compartirReporteDemoSource,
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
      within(tabla).getByRole("button", { name: /Ver pedidos de Liquidación de courier/ }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /Liquidación de courier/ });
    expect(within(dialogo).getByText(/Por fecha del dinero/)).toBeInTheDocument();
  });

  it("Cobranza: «Pedir» avisa que la acción está pendiente de integración", async () => {
    const user = renderTab("finanzas", "cobranza");
    const tabla = await screen.findByRole("table", {
      name: "Liquidaciones pendientes por courier",
    });
    await user.click(within(tabla).getAllByRole("button", { name: /^Pedir/ })[0]);
    expect(toastInfo).toHaveBeenCalledWith(
      "Pedir liquidación: pendiente de integración",
      expect.anything(),
    );
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

  it("la Supervisora ve el equipo sin columna de comisión", async () => {
    renderTab("equipo", "vendedoras", "supervisora");
    const tabla = await screen.findByRole("table", { name: "Vendedoras y caja" });
    expect(within(tabla).queryByRole("columnheader", { name: /Comisión/ })).not.toBeInTheDocument();
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
  it("la Vendedora ve sus cifras, su puesto y la comisión como decisión pendiente", async () => {
    renderTab("misventas", null, "vendedora");
    expect(await screen.findByRole("region", { name: "Vendí" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Mi comisión estimada" })).getByText("Pendiente"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("table", { name: "Mis pedidos aún no cobrados" })).toBeInTheDocument();
    expect(screen.getByText(/^Puesto [0-9] de 3\./)).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Ranking de vendedoras por facturación" }).textContent,
    ).toMatch(/\(yo\)/);
  });
});

describe("Configuración", () => {
  it("Metas: editar habilita Guardar y avisa que está pendiente; un valor inválido lo bloquea", async () => {
    const user = renderTab("configuracion", "metas");
    const campo = await screen.findByRole("textbox", { name: "Meta de Confirmados" });
    expect(campo).toHaveValue("65");
    await user.clear(campo);
    await user.type(campo, "70");
    const guardar = screen.getByRole("button", { name: /Guardar \(1\)/ });
    await user.click(guardar);
    expect(toastInfo).toHaveBeenCalledWith(
      "Guardar metas: pendiente de integración",
      expect.anything(),
    );
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

describe("Barra superior", () => {
  it("Excel completo descarga el libro demo de 9 hojas", async () => {
    const user = renderTab("resumen", null);
    await user.click(await screen.findByRole("button", { name: "Descargar Excel completo" }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    expect(saveAs.mock.calls[0][1]).toMatch(
      /^powip_panel_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_DEMO\.xlsx$/,
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/_DEMO\.xlsx$/),
      expect.anything(),
    );
  }, 30_000);

  it("Compartir muestra el reporte y permite copiarlo", async () => {
    const user = renderTab("resumen", null);
    const writeText = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(await screen.findByRole("button", { name: "Compartir reporte" }));
    const dialogo = await screen.findByRole("dialog", { name: /Compartir reporte/ });
    expect(await within(dialogo).findByText(/Venta total: S\//)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: /Copiar para WhatsApp/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^\*Reporte POWIP/));
  });
});
