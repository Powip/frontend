import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { callCenterDemoSource } from "@/features/panel-control/call-center/sources/call-center.demo";
import { resumenDemoSource } from "@/features/panel-control/resumen/sources/resumen.demo";
import { PANEL_SECCIONES_OCULTAS } from "@/features/panel-control/shared/config/panel-entrega.config";
import { autorizarRegistro } from "@/features/panel-control/shared/data/panel-sources";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { MobileBottomNav } from "../shell/MobileBottomNav";
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

const conTab = (tab: "configuracion" | "canales", subtab: string) => ({
  ...DEFAULT_PANEL_STATE,
  navigation: { tab, subtab: subtab as never },
});

describe("entrega: shell sin lo oculto", () => {
  it("no muestra Excel ni Compartir", () => {
    renderWithPanel(<PanelShell />);
    expect(screen.queryByRole("button", { name: "Descargar Excel completo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Compartir reporte" })).toBeNull();
  });

  it("no muestra el selector «Datos: reales + demo»", () => {
    renderWithPanel(<PanelShell />);
    expect(screen.queryByRole("option", { name: "Datos: reales + demo" })).toBeNull();
  });

  it("el subtítulo de Configuración solo nombra lo visible", () => {
    renderWithPanel(<PanelShell />, { state: conTab("configuracion", "canales") });
    expect(screen.queryByText("Canales, metas, reglas y cuadres")).toBeNull();
    expect(screen.getByText("Ajustes de canales")).toBeInTheDocument();
  });

  it("quitar las acciones de la lista las vuelve a mostrar", () => {
    const quitadas = PANEL_SECCIONES_OCULTAS.filter((s) => s.accion);
    const indices = quitadas.map((q) => PANEL_SECCIONES_OCULTAS.indexOf(q));
    for (const q of quitadas) PANEL_SECCIONES_OCULTAS.splice(PANEL_SECCIONES_OCULTAS.indexOf(q), 1);
    try {
      renderWithPanel(<PanelShell />);
      expect(screen.getByRole("button", { name: "Descargar Excel completo" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Datos: reales + demo" })).toBeInTheDocument();
    } finally {
      for (const [n, q] of quitadas.entries()) PANEL_SECCIONES_OCULTAS.splice(indices[n], 0, q);
    }
  });

  it("URL directa a Configuración › Metas muestra Canales, sin subpestañas sueltas", async () => {
    renderWithPanel(<PanelShell />, { state: conTab("configuracion", "metas") });
    expect(await screen.findByRole("cell", { name: /Canal real 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Metas" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Para desarrollo" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Estados y reglas" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Cuadres y calidad" })).toBeNull();
  });

  it("Ventas y canales no ofrece Publicidad y una URL directa cae en Canales", () => {
    renderWithPanel(<PanelShell />, { state: conTab("canales", "publicidad") });
    expect(screen.queryByRole("tab", { name: "Publicidad" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Productos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Canales" })).toHaveAttribute("aria-selected", "true");
  });

  it("la navegación móvil conserva sus pestañas y no expone nada oculto", () => {
    renderWithPanel(<MobileBottomNav />);
    expect(screen.getByRole("button", { name: /Ajustes/ })).toBeInTheDocument();
    expect(screen.queryByText(/Metas|Publicidad|Desarrollo/)).toBeNull();
  });
});

describe("entrega: vistas sin metas demo", () => {
  const registro = autorizarRegistro({ ...TEST_SOURCES, resumen: resumenDemoSource });

  it("el Resumen no muestra indicadores de meta aunque la fuente los entregue", async () => {
    renderWithPanel(<PanelShell />, { sources: registro });
    expect(await screen.findByText("Recompra")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Meta [≥≤]/ })).toHaveLength(0);
  });

  it("control: sin el filtro de metas ocultas el mismo Resumen sí las mostraría", async () => {
    renderWithPanel(<PanelShell />, { sources: { ...TEST_SOURCES, resumen: resumenDemoSource } });
    expect(await screen.findByText("Recompra")).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: /Meta [≥≤]/ })).length).toBeGreaterThan(0);
  });

  it("Call center no muestra indicadores de meta; sin el filtro sí", async () => {
    const state = {
      ...DEFAULT_PANEL_STATE,
      navigation: { tab: "callcenter" as const, subtab: null },
    };
    const base = { ...TEST_SOURCES, callcenter: callCenterDemoSource };
    const oculto = renderWithPanel(<PanelShell />, { state, sources: autorizarRegistro(base) });
    await screen.findByText(/Confirmaci/);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryAllByRole("button", { name: /Meta [≥≤]/ })).toHaveLength(0);
    oculto.unmount();
    renderWithPanel(<PanelShell />, { state, sources: base });
    expect((await screen.findAllByRole("button", { name: /Meta [≥≤]/ })).length).toBeGreaterThan(0);
  });
});
