import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { callCenterDemoSource } from "@/features/panel-control/call-center/sources/call-center.demo";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import {
  operacionesColaDemoSource,
  operacionesCouriersDemoSource,
  operacionesInventarioDemoSource,
} from "@/features/panel-control/operaciones/sources/operaciones.demo";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import type {
  PanelSubtabId,
  PanelTabId,
} from "@/features/panel-control/shared/models/panel-navigation.model";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

const toastInfo = jest.fn();
jest.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), success: jest.fn(), error: jest.fn() },
}));

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

const DEMO: PanelSourceRegistry = {
  ...TEST_SOURCES,
  detalle: detalleDemoSource,
  callcenter: callCenterDemoSource,
  "operaciones-cola": operacionesColaDemoSource,
  "operaciones-couriers": operacionesCouriersDemoSource,
  "operaciones-inventario": operacionesInventarioDemoSource,
};

function renderTab(
  tab: PanelTabId,
  subtab: PanelSubtabId | null,
  opciones: { role?: PanelRole; soloReal?: boolean } = {},
) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role: opciones.role ?? "dueno",
    sources: DEMO,
    state: {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab, subtab },
      dataMode: opciones.soloReal ? "solo_real" : "mixto",
    },
  });
  return user;
}

describe("Call center", () => {
  beforeEach(() => toastInfo.mockClear());

  it("muestra los seis KPI y la cola abre sus leads como estado actual", async () => {
    const user = renderTab("callcenter", null);
    await screen.findByRole("region", { name: "Por llamar ahora" });
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Por llamar ahora" })).getByRole("button", {
          name: /llamar ahora/i,
        }),
      ).toBeInTheDocument(),
    );
    for (const nombre of [
      "Leads recibidos",
      "Tiempo a 1ª llamada",
      "Contactados",
      "Confirmados",
      "Upsell",
    ]) {
      expect(screen.getByRole("region", { name: nombre })).toBeInTheDocument();
    }
    await user.click(
      within(screen.getByRole("region", { name: "Por llamar ahora" })).getByRole("button", {
        name: /llamar ahora/i,
      }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /Leads por llamar ahora/ });
    expect(within(dialogo).getByText(/Estado actual: no depende del periodo/)).toBeInTheDocument();
  });

  it("el mapa de calor se recorre con flechas y Enter abre los leads de la celda", async () => {
    const user = renderTab("callcenter", null);
    const tabla = await screen.findByRole("table", { name: /Leads por día y hora/ });
    const activa = within(tabla)
      .getAllByRole("button")
      .find((boton) => boton.getAttribute("tabindex") === "0");
    if (!activa) throw new Error("sin celda activa");
    activa.focus();
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    await user.keyboard("{ArrowRight}");
    const enfocada = document.activeElement as HTMLElement;
    expect(enfocada.dataset.celda?.startsWith("0-")).toBe(true);
    const conLeads = within(tabla)
      .getAllByRole("button", { name: /leads, confirmación/ })
      .at(0);
    if (!conLeads) throw new Error("sin celdas");
    conLeads.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: /Leads del .* a las/ })).toBeInTheDocument();
  });

  it("el ranking permite abrir la entrega de lo confirmado de cada persona", async () => {
    const user = renderTab("callcenter", null);
    const tabla = await screen.findByRole("table", { name: "Ranking de confirmadoras" });
    await user.click(
      within(tabla).getAllByRole("button", { name: /de entrega, .* Ver entregados/ })[0],
    );
    expect(
      await screen.findByRole("dialog", { name: /entregados de lo confirmado/ }),
    ).toBeInTheDocument();
  });

  it("la Confirmadora ve «Mi día» arriba y solo su fila en el ranking", async () => {
    const user = renderTab("callcenter", null, { role: "confirmadora" });
    expect(
      await screen.findByRole("heading", { name: /Mi día · Usuaria Prueba/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Puesto [0-9] de 3 en confirmación del equipo/),
    ).toBeInTheDocument();
    const tabla = await screen.findByRole("table", { name: "Ranking de confirmadoras" });
    const filas = within(tabla).getAllByRole("row").slice(1, -1);
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toMatch(/Usuaria Prueba/);
    expect(screen.queryByRole("combobox", { name: /asesor/i })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("region", { name: "Leads recibidos" })).getByRole("button", {
        name: /ver leads/i,
      }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /Leads recibidos/ });
    await within(dialogo).findByText("Facturación");
    const celdas = within(dialogo)
      .getAllByRole("row")
      .slice(1)
      .map((fila) => fila.textContent ?? "");
    expect(celdas.length).toBeGreaterThan(0);
    expect(celdas.every((texto) => texto.includes("Usuaria Prueba"))).toBe(true);
  });

  it("en modo solo reales queda pendiente y no muestra cifras demo", async () => {
    renderTab("callcenter", null, { soloReal: true });
    expect((await screen.findAllByText(/pendiente de integración/i)).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("table", { name: "Ranking de confirmadoras" }),
    ).not.toBeInTheDocument();
  });
});

describe("Operaciones", () => {
  beforeEach(() => toastInfo.mockClear());

  it("cada celda de la matriz abre esos pedidos y la acción avisa que está pendiente", async () => {
    const user = renderTab("operaciones", "cola");
    const tabla = await screen.findByRole("table", { name: "Cola por estado y antigüedad" });
    const celda = within(tabla).getAllByRole("button", { name: /pedidos\. Ver pedidos$/ })[0];
    await user.click(celda);
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Estado actual/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(within(tabla).getByRole("button", { name: /^Preparar/ }));
    expect(toastInfo).toHaveBeenCalledWith("Preparar: pendiente de integración", expect.anything());
  });

  it("los despachos de un día se abren por fecha de despacho", async () => {
    const user = renderTab("operaciones", "cola");
    await screen.findByRole("table", { name: "Cola por estado y antigüedad" });
    const barra = (await screen.findAllByRole("button", { name: /despachados\. Ver pedidos$/ }))[0];
    await user.click(barra);
    const dialogo = await screen.findByRole("dialog", { name: /Despachados el/ });
    expect(within(dialogo).getByText(/Por fecha de despacho/)).toBeInTheDocument();
  });

  it("couriers: la Supervisora no ve flete y un courier sin plazo muestra «Pendiente»", async () => {
    renderTab("operaciones", "couriers", { role: "supervisora" });
    const tabla = await screen.findByRole("table", { name: "Rendimiento por courier" });
    expect(within(tabla).queryByRole("columnheader", { name: /Flete/ })).not.toBeInTheDocument();
    expect(
      within(tabla).queryByRole("columnheader", { name: /Costo rechazos/ }),
    ).not.toBeInTheDocument();
    const fila = within(tabla)
      .getByRole("button", { name: /Ver envíos de Courier demo C/ })
      .closest("tr");
    expect(fila?.textContent).toMatch(/Pendiente/);
    expect(screen.queryByRole("region", { name: "Flete promedio" })).not.toBeInTheDocument();
  });

  it("inventario: el stock negativo es «Error de datos» y el valor al costo es solo del Dueño", async () => {
    renderTab("operaciones", "inventario");
    const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
    expect(within(tabla).getAllByText("Error de datos").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Valor al costo" })).toBeInTheDocument();
  });

  it("inventario para la Supervisora sin costo ni valor", async () => {
    renderTab("operaciones", "inventario", { role: "supervisora" });
    const tabla = await screen.findByRole("table", { name: "Stock y cobertura" });
    expect(within(tabla).queryByRole("columnheader", { name: /Costo/ })).not.toBeInTheDocument();
    expect(within(tabla).queryByRole("columnheader", { name: /^Valor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Valor al costo" })).not.toBeInTheDocument();
  });
});
