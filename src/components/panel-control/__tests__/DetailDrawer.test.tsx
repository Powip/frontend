import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DetalleGrupo } from "@/features/panel-control/detalle/models/detalle.model";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { DetailDrawer } from "../DetailDrawer";
import { renderWithPanel, TEST_SOURCES } from "./render-with-panel";

const toastInfo = jest.fn();
jest.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), success: jest.fn(), error: jest.fn() },
}));

function Abrir({ grupo }: { grupo: DetalleGrupo }) {
  const { openDrilldown } = usePanel();
  return (
    <button type="button" onClick={() => openDrilldown(grupo)}>
      Abrir detalle
    </button>
  );
}

async function abrir(role: PanelRole, grupo: DetalleGrupo = grupos.ventas()) {
  const user = userEvent.setup();
  renderWithPanel(
    <>
      <Abrir grupo={grupo} />
      <DetailDrawer />
    </>,
    { role, sources: { ...TEST_SOURCES, detalle: detalleDemoSource } },
  );
  await user.click(screen.getByRole("button", { name: "Abrir detalle" }));
  const dialogo = await screen.findByRole("dialog", { name: new RegExp(grupo.titulo, "i") });
  await within(dialogo).findByText("Facturación");
  return { user, dialogo };
}

describe("DetailDrawer", () => {
  beforeEach(() => toastInfo.mockClear());

  it("muestra periodo y filtros aplicados, canal de origen separado del de cierre y marca demo", async () => {
    const { dialogo } = await abrir("dueno");
    expect(
      within(dialogo).getByText(/Periodo 1 set – 21 set 2026 \(hora Lima\)/),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText(/Filtros: Sin filtros/)).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("columnheader", { name: /canal de origen/i }),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole("columnheader", { name: /cerrado por/i })).toBeInTheDocument();
    expect(within(dialogo).getAllByRole("button", { name: /^Demo:/ }).length).toBeGreaterThan(0);
  });

  it("recibe el foco al abrirse y se cierra con un solo Escape", async () => {
    const { user, dialogo } = await abrir("dueno");
    expect(dialogo).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("pagina con el contrato y no presenta la primera página como el total", async () => {
    const { user, dialogo } = await abrir("dueno");
    const estado = within(dialogo).getByText(/^Mostrando 1–100 de/);
    const total = Number(
      estado.textContent?.match(/de ([\d,.]+) pedidos/)?.[1].replace(/[,.]/g, ""),
    );
    expect(total).toBeGreaterThan(100);
    expect(
      within(dialogo).getByText(/ordenar la tabla solo aplica a esta página/),
    ).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Página siguiente" }));
    expect(await within(dialogo).findByText(/^Mostrando 101–200 de/)).toBeInTheDocument();
  });

  it("busca en todo el grupo a través del contrato", async () => {
    const { user, dialogo } = await abrir("dueno");
    await user.type(
      within(dialogo).getByRole("searchbox", { name: /buscar pedidos del grupo/i }),
      "zzz-no-existe",
    );
    expect(await within(dialogo).findByText(/Ningún pedido coincide/)).toBeInTheDocument();
  });

  it("la acción por pedido es un enlace a la pantalla, con el pedido a buscar", async () => {
    const grupo = grupos.porLiquidar();
    const { dialogo } = await abrir("dueno", grupo);
    const enlace = within(dialogo).getAllByRole("link", { name: /^Pedir liquidación / })[0];
    expect(enlace).toHaveAttribute("href", "/operaciones/liquidaciones");
    expect(within(dialogo).queryByText("(pendiente)")).not.toBeInTheDocument();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("asignar guía lleva a Por Despachar buscando el número del pedido", async () => {
    const grupo = grupos.accion("ventas_sin_guia", "Ventas sin guía", "asignar_guia");
    const { dialogo } = await abrir("dueno", grupo);
    const enlace = within(dialogo).getAllByRole("link", { name: /^Asignar guía / })[0];
    const numero = enlace.getAttribute("aria-label")?.replace("Asignar guía ", "") ?? "";
    expect(numero).not.toBe("");
    expect(enlace).toHaveAttribute(
      "href",
      `/operaciones/pedidos?tab=preparados&q=${encodeURIComponent(numero)}`,
    );
  });

  it("avisar al cliente abre WhatsApp en pestaña nueva, sin teléfono inventado", async () => {
    const grupo = grupos.accion("productos_agotados", "Productos agotados", "avisar_cliente");
    const { dialogo } = await abrir("dueno", grupo);
    const enlace = within(dialogo).getAllByRole("link", { name: /^Avisar al cliente / })[0];
    expect(enlace.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("completar motivo sigue pendiente con aviso", async () => {
    const grupo = grupos.accion(
      "anulaciones_sin_motivo",
      "Anulaciones sin motivo",
      "completar_motivo",
    );
    const { user, dialogo } = await abrir("dueno", grupo);
    await user.click(
      within(dialogo).getAllByRole("button", {
        name: /Completar motivo .*pendiente de integración/,
      })[0],
    );
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining("Completar motivo"),
      expect.objectContaining({ description: expect.stringContaining("/panel/acciones") }),
    );
  });

  it("indica estado actual en los grupos de Qué hacer hoy", async () => {
    const grupo = grupos.accion("ventas_sin_guia", "Ventas sin guía", "asignar_guia");
    const { dialogo } = await abrir("dueno", grupo);
    expect(within(dialogo).getByText(/Estado actual: no depende del periodo/)).toBeInTheDocument();
  });

  it("la vista por producto muestra margen solo al Dueño", async () => {
    const dueno = await abrir("dueno");
    await dueno.user.click(within(dueno.dialogo).getByRole("button", { name: "Por producto" }));
    expect(
      within(dueno.dialogo).getByRole("columnheader", { name: /margen/i }),
    ).toBeInTheDocument();
  });

  it("la Confirmadora no ve margen", async () => {
    const confirmadora = await abrir("confirmadora");
    await confirmadora.user.click(
      within(confirmadora.dialogo).getByRole("button", { name: "Por producto" }),
    );
    expect(
      within(confirmadora.dialogo).queryByRole("columnheader", { name: /margen/i }),
    ).not.toBeInTheDocument();
  });

  it("abierto desde un producto, el encabezado avisa que suma solo el ítem", async () => {
    const user = userEvent.setup();
    const soloItem: typeof detalleDemoSource = {
      ...detalleDemoSource,
      fetch: async (query, context) => {
        const r = await detalleDemoSource.fetch(query, context);
        return { ...r, resumen: { ...r.resumen, alcance: "lineas" } };
      },
    };
    renderWithPanel(
      <>
        <Abrir grupo={grupos.ventas()} />
        <DetailDrawer />
      </>,
      { role: "dueno", sources: { ...TEST_SOURCES, detalle: soloItem } },
    );
    await user.click(screen.getByRole("button", { name: "Abrir detalle" }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText("Facturación del ítem")).toBeInTheDocument();
    expect(within(dialogo).getByText("Unidades del ítem")).toBeInTheDocument();
    expect(within(dialogo).getByRole("note")).toHaveTextContent(/muestran su total completo/);
  });
});
