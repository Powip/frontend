import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderWithPanel } from "@/components/panel-control/__tests__/render-with-panel";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

const toastInfo = jest.fn();
jest.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), success: jest.fn() },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const tabs = () =>
  within(screen.getByRole("tablist", { name: "Secciones del panel" }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent);

describe("PanelShell", () => {
  beforeEach(() => toastInfo.mockClear());

  it("muestra al Dueño todas las pestañas, filtros, Excel y la línea de estado demo", async () => {
    renderWithPanel(<PanelShell />);
    expect(tabs()).toEqual([
      "Resumen",
      "Ventas y canales",
      "Call center",
      "Operaciones",
      "Finanzas",
      "Equipo",
      "Configuración",
    ]);
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("group", { name: "Filtros del panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar Excel completo" })).toBeInTheDocument();
    expect(await screen.findByText(/del periodo aún abierto/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Demo:/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 set – 21 set/)).toBeInTheDocument();
  });

  it("la Supervisora inicia en Operaciones y no ve Finanzas ni Configuración", () => {
    renderWithPanel(<PanelShell />, { role: "supervisora" });
    expect(tabs()).toEqual(["Resumen", "Ventas y canales", "Call center", "Operaciones", "Equipo"]);
    expect(screen.getByRole("tab", { name: "Operaciones" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tablist", { name: /subsecciones de operaciones/i }),
    ).toBeInTheDocument();
  });

  it("la Confirmadora solo ve Call center, sin Excel completo ni Compartir, con asesora fija", () => {
    renderWithPanel(<PanelShell />, { role: "confirmadora" });
    expect(tabs()).toEqual(["Call center"]);
    expect(
      screen.queryByRole("button", { name: "Descargar Excel completo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir reporte" })).not.toBeInTheDocument();
    expect(screen.getByText("(fijo por rol)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar filtro Asesor/ })).not.toBeInTheDocument();
  });

  it("bloquea con explicación a un rol sin equivalencia", () => {
    renderWithPanel(<PanelShell />, { role: null });
    expect(
      screen.getByRole("heading", { name: /tu rol todavía no tiene una vista/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("PANEL_ROL_SUPERVISORA")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("navega entre pestañas con flechas del teclado", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />);
    screen.getByRole("tab", { name: "Resumen" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Ventas y canales" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Ventas y canales");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Configuración" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("aplica y quita filtros con chips", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />);
    const tienda = screen.getByRole("combobox", { name: "Tienda" });
    await user.selectOptions(tienda, "tienda-1");
    const chips = screen.getByRole("region", { name: "Filtros activos" });
    expect(within(chips).getByText("Tienda Uno")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar filtro Tienda: Tienda Uno" }));
    expect(screen.queryByRole("region", { name: "Filtros activos" })).not.toBeInTheDocument();
  });

  it("carga canales reales en el filtro de canal", async () => {
    renderWithPanel(<PanelShell />);
    const canal = screen.getByRole("combobox", { name: "Canal" });
    await waitFor(() =>
      expect(within(canal).getByRole("option", { name: "Canal real 1" })).toBeInTheDocument(),
    );
  });

  it("los botones sin contrato avisan que están pendientes de integración", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />);
    await user.click(screen.getByRole("button", { name: "Descargar Excel completo" }));
    expect(toastInfo).toHaveBeenCalledWith(
      "Excel completo: pendiente de integración",
      expect.objectContaining({ description: expect.stringContaining("/panel/export.xlsx") }),
    );
  });

  it("en modo solo reales las fuentes demo quedan como pendientes", async () => {
    renderWithPanel(<PanelShell />, { state: { ...DEFAULT_PANEL_STATE, dataMode: "solo_real" } });
    expect((await screen.findAllByRole("button", { name: /^Pendiente:/ })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryAllByRole("button", { name: /^Demo:/ })).toHaveLength(0);
    expect(screen.queryByText(/del periodo aún abierto/)).not.toBeInTheDocument();
  });

  it("Configuración > Canales muestra fichas reales con campos pendientes", async () => {
    renderWithPanel(<PanelShell />, {
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "configuracion", subtab: "canales" } },
    });
    expect(await screen.findByRole("cell", { name: /Canal real 1/ })).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  });
});
