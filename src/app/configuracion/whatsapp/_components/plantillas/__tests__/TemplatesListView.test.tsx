import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  abRunningTemplateFixture,
  abWithWinnerTemplateFixture,
  pendingNewTemplateFixture,
  pendingWithApprovedVersionTemplateFixture,
  rejectedTemplateFixture,
  templatesListFixture,
} from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { TemplatesListView } from "../TemplatesListView";

function renderList(props: Partial<Parameters<typeof TemplatesListView>[0]> = {}) {
  const handlers = {
    onCreate: jest.fn(),
    onEdit: jest.fn(),
    onDuplicate: jest.fn(),
    onRetry: jest.fn(),
  };
  render(
    <TemplatesListView
      state={{ kind: "pending-integration" }}
      canManage
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("TemplatesListView", () => {
  it("sin integración muestra pendiente y no lo confunde con una lista vacía", () => {
    renderList();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Listado de plantillas pendiente de integración",
    );
    expect(screen.queryByText("Todavía no tienes plantillas")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Filtrar por estado en Meta" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva plantilla" })).toBeEnabled();
  });

  it("muestra carga, error con reintento y vacío real", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <TemplatesListView
        state={{ kind: "loading" }}
        canManage
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDuplicate={jest.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando plantillas");
    unmount();

    const onRetry = jest.fn();
    const errorView = render(
      <TemplatesListView
        state={{ kind: "error", message: "Error 503" }}
        canManage
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDuplicate={jest.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las plantillas");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    errorView.unmount();

    renderList({ state: { kind: "ready", data: [] } });
    expect(screen.getByText("Todavía no tienes plantillas")).toBeInTheDocument();
  });

  it("muestra nombre, uso, categoría, estado y métricas sin inventar valores", () => {
    renderList({
      state: { kind: "ready", data: [abWithWinnerTemplateFixture, pendingNewTemplateFixture] },
    });
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("pedido_en_camino");
    expect(rows[1]).toHaveTextContent("Pedido en camino");
    expect(rows[1]).toHaveTextContent("Utilidad");
    expect(rows[1]).toHaveTextContent("Aprobada");
    expect(rows[1]).toHaveTextContent("298");
    expect(rows[1]).toHaveTextContent("A 84% · B 89%. Ganadora: versión B");
    expect(rows[2]).toHaveTextContent("saldo_pendiente");
    expect(rows[2]).toHaveTextContent("En revisión");
    expect(within(rows[2]).getAllByText("—")).toHaveLength(3);
  });

  it("no inventa ganador A/B sin resultados", () => {
    renderList({ state: { kind: "ready", data: [abRunningTemplateFixture] } });
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("A/B en curso · sin resultados");
    expect(table).not.toHaveTextContent("Ganadora");
  });

  it("muestra el motivo de rechazo y la versión aprobada en uso", () => {
    renderList({
      state: {
        kind: "ready",
        data: [rejectedTemplateFixture, pendingWithApprovedVersionTemplateFixture],
      },
    });
    expect(screen.getByText(rejectedTemplateFixture.metaReason ?? "")).toBeInTheDocument();
    expect(
      screen.getByText("Mientras tanto se sigue enviando la versión aprobada anterior."),
    ).toBeInTheDocument();
  });

  it("filtra por estado en Meta", async () => {
    const user = userEvent.setup();
    renderList({ state: { kind: "ready", data: templatesListFixture } });
    await user.click(screen.getByRole("button", { name: "Rechazadas" }));
    expect(screen.getByRole("button", { name: "Rechazadas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("recompra_descuento");
  });

  it("edita y duplica desde la fila", async () => {
    const user = userEvent.setup();
    const handlers = renderList({ state: { kind: "ready", data: [abWithWinnerTemplateFixture] } });
    await user.click(screen.getByRole("button", { name: "Editar plantilla pedido_en_camino" }));
    expect(handlers.onEdit).toHaveBeenCalledWith(abWithWinnerTemplateFixture);
    await user.click(screen.getByRole("button", { name: "Duplicar plantilla pedido_en_camino" }));
    expect(handlers.onDuplicate).toHaveBeenCalledWith(abWithWinnerTemplateFixture);
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
  });

  it("sin permisos no ofrece crear ni duplicar", () => {
    renderList({ state: { kind: "ready", data: [abWithWinnerTemplateFixture] }, canManage: false });
    expect(screen.queryByRole("button", { name: "Nueva plantilla" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Duplicar/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver plantilla pedido_en_camino" }),
    ).toBeInTheDocument();
  });

  it("muestra el aviso de aprobación solo si se le pasa", async () => {
    const user = userEvent.setup();
    const onActivateRule = jest.fn();
    renderList({
      state: { kind: "ready", data: [] },
      approvedNotice: {
        templateName: "saldo_pendiente",
        canActivateRule: true,
        onActivateRule,
        onDismiss: jest.fn(),
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Meta aprobó saldo_pendiente");
    await user.click(screen.getByRole("button", { name: "Activar en una regla" }));
    expect(onActivateRule).toHaveBeenCalledTimes(1);
  });
});
