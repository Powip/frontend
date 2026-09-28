import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import { resumenDemoSource } from "@/features/panel-control/resumen/sources/resumen.demo";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
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
  resumen: resumenDemoSource,
  detalle: detalleDemoSource,
};

const valorDe = (nombre: string) =>
  within(screen.getByRole("region", { name: nombre })).getByText(/^S\/ /).textContent;

async function listo() {
  await screen.findByRole("region", { name: "Vendí" });
  await waitFor(() => expect(valorDe("Vendí")).toMatch(/^S\/ \d/));
}

describe("ResumenView", () => {
  beforeEach(() => toastInfo.mockClear());

  it("muestra las cuatro tarjetas con datos demo marcados y Vendí cuadra con su detalle", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    for (const nombre of ["Vendí", "Gané (parcial)", "Me deben", "Por hacer hoy"]) {
      const tarjeta = screen.getByRole("region", { name: nombre });
      expect(within(tarjeta).getByRole("button", { name: /^Demo:/ })).toBeInTheDocument();
    }
    const gane = screen.getByRole("region", { name: "Gané (parcial)" });
    expect(within(gane).getByText(/^≤ S\/ /)).toBeInTheDocument();
    expect(within(gane).getByText(/es\s+un tope, no la ganancia final/)).toBeInTheDocument();
    expect(within(gane).queryByRole("button", { name: /periodo anterior/i })).toBeNull();
    const vendi = valorDe("Vendí");
    await user.click(
      within(screen.getByRole("region", { name: "Vendí" })).getByRole("button", {
        name: /ver pedidos/i,
      }),
    );
    const dialogo = await screen.findByRole("dialog", { name: /^Ventas/ });
    const facturacion = await within(dialogo).findByText("Facturación");
    expect(facturacion.nextElementSibling?.textContent).toBe(vendi);
  });

  it("la Supervisora ve Entregado en lugar de Gané", async () => {
    renderWithPanel(<PanelShell />, {
      sources: DEMO,
      role: "supervisora",
      state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "resumen", subtab: null } },
    });
    await listo();
    expect(screen.getByRole("region", { name: "Entregado" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Gané" })).not.toBeInTheDocument();
  });

  it("en modo solo reales cada bloque queda pendiente y no se muestra ninguna cifra demo", async () => {
    renderWithPanel(<PanelShell />, {
      sources: DEMO,
      state: { ...DEFAULT_PANEL_STATE, dataMode: "solo_real" },
    });
    expect(await screen.findAllByText("Pendiente de integración")).toHaveLength(6);
    expect(screen.queryAllByRole("button", { name: /^Demo:/ })).toHaveLength(0);
    for (const nombre of ["Vendí", "Gané", "Me deben", "Por hacer hoy"]) {
      expect(
        within(screen.getByRole("region", { name: nombre })).getByText("—"),
      ).toBeInTheDocument();
    }
  });

  it("cada tarea abre sus pedidos, «Ir →» navega y «Ver la lista» lleva a la lista", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    const lista = screen.getByRole("list", { name: "Tareas ordenadas por urgencia" });
    const primera = within(lista).getAllByRole("listitem")[0];
    const boton = within(primera).getByRole("button", { name: /ver \d+ pedidos/i });
    const cantidad = boton.textContent?.match(/Ver ([\d,.]+) pedidos/)?.[1];
    await user.click(boton);
    const dialogo = await screen.findByRole("dialog");
    expect(
      await within(dialogo).findByText(new RegExp(`de ${cantidad} pedidos`)),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText(/Estado actual: no depende del periodo/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(
      within(screen.getByRole("region", { name: "Por hacer hoy" })).getByRole("button", {
        name: /ver la lista/i,
      }),
    );
    expect(screen.getByText("Qué hacer hoy")).toHaveFocus();

    const ir = within(lista).getAllByRole("button", { name: /^Ir a / })[0];
    await user.click(ir);
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "false");
  });

  it("una barra diaria abre el detalle del día con el teclado", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    const barra = screen.getByRole("button", { name: /^1 set: S\/ .* Ver pedidos$/ });
    barra.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: /Ventas del 1 set/ })).toBeInTheDocument();
    expect(screen.getByText("Periodo anterior (misma antigüedad)")).toBeInTheDocument();
  });

  it("sin comparación válida omite la línea y explica por qué", async () => {
    const sinAnterior: PanelSourceRegistry = {
      ...DEMO,
      resumen: {
        ...resumenDemoSource,
        fetch: async (query, context) => ({
          ...(await resumenDemoSource.fetch(query, context)),
          anterior_misma_antiguedad: null,
        }),
      },
    };
    renderWithPanel(<PanelShell />, { sources: sinAnterior });
    await listo();
    expect(
      screen.getByText(/la fuente no entrega el periodo anterior a la misma antigüedad/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Periodo anterior (misma antigüedad)")).not.toBeInTheDocument();
  });

  it("un canal abre su detalle y la suma por canal cuadra con Vendí", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    const vendi = valorDe("Vendí");
    const lista = screen.getByRole("list", { name: "Facturación por canal" });
    const tarjeta = lista.closest("section");
    expect(
      tarjeta && within(tarjeta).getByText(new RegExp(`^Total ${vendi?.replace("/", "\\/")}`)),
    ).toBeInTheDocument();
    await user.click(within(lista).getAllByRole("button")[0]);
    expect(await screen.findByRole("dialog", { name: /· ventas/ })).toBeInTheDocument();
  });

  it("los filtros de dimensión actualizan las tarjetas", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    const antes = valorDe("Vendí");
    await user.click(screen.getByRole("button", { name: /más filtros/i }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Zona" }), "provincia");
    await waitFor(() => expect(valorDe("Vendí")).not.toBe(antes));
  });

  it("el flujo abre el conjunto correcto y muestra los cuadres", async () => {
    const user = userEvent.setup();
    renderWithPanel(<PanelShell />, { sources: DEMO });
    await listo();
    await user.click(screen.getByText("Flujo de pedidos · de lead a dinero cobrado"));
    expect(screen.getAllByText("✓")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /^Rechazados: .* Ver pedidos$/ }));
    const dialogo = await screen.findByRole("dialog", { name: /Rechazados/ });
    await within(dialogo).findByText("Facturación");
    const estados = within(dialogo).getAllByText("Rechazado");
    expect(estados.length).toBeGreaterThan(0);
  });
});
