/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: PorDespacharTab — habilitación de "Generar guía".
 *
 * Bug corregido: un pedido PAGADO ("PENDIENTE + cobrado al 100%", todavía no
 * empacado por almacén) se trataba como si ya estuviera PREPARADO y podía
 * armarse guía directo desde /operaciones/pedidos — cobrar el 100% no es lo
 * mismo que preparar el pedido. Ahora PAGADO queda fuera de
 * `GUIDE_ELIGIBLE_STATUSES` (igual que PENDIENTE) y ni siquiera llega a esta
 * pestaña (se filtra en PedidosContent.tsx, ver PRE_FULFILLMENT_STATUSES).
 *
 * Estos tests verifican el comportamiento observable de la pestaña:
 *  - al seleccionar un pedido PREPARADO elegible, "Generar guía (1)" queda
 *    habilitado y al confirmarlo se pasa ese pedido a `onOpenCreateGuide`.
 *  - un pedido PENDIENTE o PAGADO (no elegibles) dejan el botón en "(0 de 1)"
 *    y muestran el aviso de "no se pueden incluir en una guía".
 *  - la elegibilidad sigue exigiendo entrega a DOMICILIO y ausencia de guía.
 *  - con selección, "Generar guía" nunca descarta pedidos en silencio: si hay
 *    bloqueados abre una revisión con el motivo de cada uno (retiro en
 *    tienda, guía existente, estado, tipo de entrega faltante), permite
 *    editar el tipo de entrega de los de retiro y solo genera para los
 *    elegibles de forma explícita.
 *  - al volver de editar (`guideReturn`) se restaura la selección y, solo si
 *    se guardó, se ofrece "Continuar con la
 *    generación" sin abrir la creación de guía por su cuenta.
 *
 * Work-arounds jsdom / mocks: se reemplazan las primitivas de UI (button,
 * table, checkbox, popover, calendar, select, tooltip), los helpers de export
 * (xlsx / file-saver), los iconos (lucide-react) y los componentes hijos
 * pesados (SalesTableFilters, BulkStatusSelect, SourceBadge) por stubs
 * mínimos. `applyFilters` / `emptySalesFilters` se mantienen reales.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks de infraestructura ────────────────────────────────────────────────

jest.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => new ArrayBuffer(0)),
}));

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

jest.mock("date-fns/locale", () => ({ es: {} }));

jest.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return true;
        return () => null;
      },
    },
  ),
);

jest.mock("next/image", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/shared/WhatsAppIcon", () => ({
  WhatsAppIcon: () => null,
}));

jest.mock("@/components/shared/SourceBadge", () => ({
  SourceBadge: () => null,
}));

jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));

jest.mock("@/components/ui/pagination", () => ({ Pagination: () => null }));

// El contenido del Popover (calendario del mes + menú de columnas) no se
// renderiza — solo interesa el trigger.
jest.mock("@/components/ui/popover", () => {
  const R = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    R.createElement(R.Fragment, null, children);
  return {
    Popover: Pass,
    PopoverTrigger: Pass,
    PopoverContent: () => null,
  };
});

jest.mock("@/components/ui/tooltip", () => {
  const R = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    R.createElement(R.Fragment, null, children);
  return {
    Tooltip: Pass,
    TooltipTrigger: Pass,
    TooltipContent: Pass,
    TooltipProvider: Pass,
  };
});

jest.mock("@/components/ui/checkbox", () => {
  const R = require("react");
  const Checkbox = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) =>
    R.createElement("input", {
      type: "checkbox",
      checked: !!checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onCheckedChange?.(e.target.checked),
    });
  return { Checkbox };
});

jest.mock("@/components/ui/button", () => {
  const R = require("react");
  const Button = ({
    children,
    onClick,
    disabled,
    title,
    type,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    type?: "button" | "submit" | "reset";
    "aria-label"?: string;
  }) =>
    R.createElement(
      "button",
      {
        onClick,
        disabled: !!disabled,
        title,
        type: type ?? "button",
        "aria-label": ariaLabel,
      },
      children,
    );
  return { Button, buttonVariants: () => "" };
});

jest.mock("@/components/ui/table", () => {
  const R = require("react");
  const el =
    (tag: string) =>
    ({
      children,
      colSpan,
    }: {
      children?: React.ReactNode;
      colSpan?: number;
    }) =>
      R.createElement(tag, { colSpan }, children);
  return {
    Table: el("table"),
    TableHeader: el("thead"),
    TableBody: el("tbody"),
    TableRow: el("tr"),
    TableHead: el("th"),
    TableCell: el("td"),
  };
});

jest.mock("@/components/ui/select", () => {
  const R = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    R.createElement("div", null, children);
  return {
    Select: Pass,
    SelectTrigger: Pass,
    SelectContent: Pass,
    SelectGroup: Pass,
    SelectValue: () => null,
    SelectItem: () => null,
    SelectSeparator: () => null,
    SelectLabel: () => null,
    SelectScrollUpButton: () => null,
    SelectScrollDownButton: () => null,
  };
});

// Dialog de Radix → contenedor simple que solo se renderiza abierto.
jest.mock("@/components/ui/dialog", () => {
  const R = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    R.createElement("div", null, children);
  return {
    Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
      open ? R.createElement("div", { role: "dialog" }, children) : null,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) =>
      R.createElement("h2", null, children),
    DialogDescription: ({ children }: { children?: React.ReactNode }) =>
      R.createElement("p", null, children),
  };
});

jest.mock("@/components/ventas/BulkStatusSelect", () => ({
  BulkStatusSelect: () => null,
}));

// SalesTableFilters se stubea a null pero se conservan los helpers puros
// `applyFilters` y `emptySalesFilters` que la pestaña importa del mismo módulo.
jest.mock("@/components/ventas/SalesTableFilters", () => {
  const actual = jest.requireActual("@/components/ventas/SalesTableFilters");
  return { ...actual, SalesTableFilters: () => null };
});

// ── Imports bajo prueba (después de los mocks) ──────────────────────────────

import { PorDespacharTab } from "../PorDespacharTab";
import { OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import type { PedidosActions, Sale } from "../types";
import type { OrderStatus } from "@/interfaces/IOrder";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const nowIso = new Date().toISOString();
  return {
    id: "sale-1",
    customerId: "cust-1",
    orderNumber: "ORD-0001",
    clientName: "Juan Pérez",
    phoneNumber: "999111222",
    date: "01/01/2026",
    total: 150,
    status: "PREPARADO" as OrderStatus,
    paymentMethod: "EFECTIVO",
    deliveryType: "DOMICILIO",
    salesRegion: "LIMA",
    district: "Miraflores",
    address: "Av. Test 123",
    advancePayment: 150,
    pendingPayment: 0,
    notes: "",
    guideNumber: null,
    hasPendingApprovalPayments: false,
    sellerName: "Vendedor 1",
    createdAt: nowIso,
    updatedAt: nowIso,
    callbackAt: null,
    items: [],
    ...overrides,
  };
}

function makeActions(overrides: Partial<PedidosActions> = {}): PedidosActions {
  return {
    can: jest.fn().mockReturnValue(true),
    apiCouriers: [],
    salesChannels: [],
    isBulkLoading: false,
    onOpenPayment: jest.fn(),
    onOpenGuide: jest.fn(),
    onReassignSeller: jest.fn(),
    onCancel: jest.fn(),
    onChangeStatus: jest.fn(),
    onMarkNoAnswer: jest.fn(),
    onBulkMarkNoAnswer: jest.fn(),
    onDeliveryReschedule: jest.fn(),
    onBulkDeliveryReschedule: jest.fn(),
    onOpenCreateGuide: jest.fn(),
    onOpenAddToGuide: jest.fn(),
    onAssignCourierBulk: jest.fn(),
    onBulkStatusChange: jest.fn(),
    onBulkWhatsApp: jest.fn(),
    onBulkPrint: jest.fn(),
    onCopySelected: jest.fn(),
    onExportExcel: jest.fn(),
    onWhatsApp: jest.fn(),
    onEdit: jest.fn(),
    onEditDeliveryType: jest.fn(),
    onSyncCourier: jest.fn(),
    onReturnToStock: jest.fn(),
    onMarkAsLoss: jest.fn(),
    ...overrides,
  } as unknown as PedidosActions;
}

/** Selecciona el checkbox de la última fila de la tabla (los de fila van
 *  después del "seleccionar todo" de la cabecera). Los checkboxes de la tabla
 *  no tienen nombre accesible, de ahí el acceso por rol + posición. */
async function selectLastRow(user: ReturnType<typeof userEvent.setup>) {
  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[checkboxes.length - 1]);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PorDespacharTab — armado de guía", () => {
  it("un pedido PREPARADO a domicilio y sin guía, al seleccionarlo, habilita 'Generar guía (1)'", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-preparado-1",
      orderNumber: "ORD-PREPARADO-1",
      status: "PREPARADO",
      deliveryType: "DOMICILIO",
      guideNumber: null,
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />, { wrapper: OrderDetailModalProvider });

    expect(screen.getByText("ORD-PREPARADO-1")).toBeInTheDocument();

    await selectLastRow(user);

    expect(
      screen.getByRole("button", { name: /generar guía \(1\)/i }),
    ).toBeEnabled();
    expect(
      screen.queryByText(
        /pedido\(s\) seleccionados no se pueden incluir en una guía/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("al confirmar 'Generar guía' pasa el pedido PREPARADO a onOpenCreateGuide", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const sale = makeSale({ id: "sale-preparado-1", status: "PREPARADO" });

    render(<PorDespacharTab sales={[sale]} actions={actions} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);

    await user.click(
      screen.getByRole("button", { name: /generar guía \(1\)/i }),
    );

    expect(actions.onOpenCreateGuide).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "sale-preparado-1", status: "PREPARADO" }),
    ]);
  });

  it("sin selección, el botón 'Generar Guía' de la cabecera está deshabilitado", () => {
    render(<PorDespacharTab sales={[makeSale()]} actions={makeActions()} />, { wrapper: OrderDetailModalProvider });

    expect(
      screen.getByRole("button", { name: /generar guía/i }),
    ).toBeDisabled();
  });

  it("un pedido PENDIENTE seleccionado deja 'Generar guía (0 de 1)', muestra el aviso por estado y la revisión no ofrece generar", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const sale = makeSale({
      id: "sale-pendiente-1",
      orderNumber: "ORD-PEND-1",
      status: "PENDIENTE",
      deliveryType: "DOMICILIO",
    });

    render(<PorDespacharTab sales={[sale]} actions={actions} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);

    expect(
      screen.getByText(
        /pedido\(s\) seleccionados no se pueden incluir en una guía/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 por su estado actual/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("ORD-PEND-1")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/estado «.*» no permite generar guía/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/retiro en tienda/i)).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /generar guía para/i }),
    ).not.toBeInTheDocument();
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
  });

  it("un pedido PAGADO seleccionado deja 'Generar guía (0 de 1)' y muestra el aviso de estado no elegible (cobrado no es preparado)", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-pagado-1",
      orderNumber: "ORD-PAGADO-1",
      status: "PAGADO",
      deliveryType: "DOMICILIO",
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);

    expect(
      screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }),
    ).toBeEnabled();
    expect(
      screen.getByText(
        /pedido\(s\) seleccionados no se pueden incluir en una guía/i,
      ),
    ).toBeInTheDocument();
  });

  it("un pedido PREPARADO con retiro en tienda: abre el modal de retiro y deriva la edición sin generar guía", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const sale = makeSale({
      id: "sale-preparado-retiro",
      orderNumber: "ORD-RETIRO-1",
      status: "PREPARADO",
      deliveryType: "RETIRO TIENDA", // así lo deja mapOrderToSale
    });

    render(<PorDespacharTab sales={[sale]} actions={actions} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);

    expect(
      screen.getByText(/1 configurado\(s\) como retiro en tienda/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "Este pedido está configurado como retiro en tienda",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "El pedido ORD-RETIRO-1 no puede generar una guía porque su tipo de entrega es “Retiro en tienda”. Si necesita un envío, podés editar el tipo de entrega.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/tipo de entrega actual/i)).toHaveTextContent(
      "Retiro en tienda",
    );
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(
      within(dialog).getByText(/al guardar, volverás a por despachar con tu selección/i),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Abrir venta para editar entrega" }),
    );

    expect(actions.onEditDeliveryType).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sale-preparado-retiro" }),
      expect.objectContaining({ selectedIds: ["sale-preparado-retiro"] }),
    );
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el botón 'Generar Guía' de la cabecera abre el mismo modal de retiro, y 'Cancelar' lo cierra sin editar ni generar", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const sale = makeSale({ deliveryType: "RETIRO TIENDA" });

    render(<PorDespacharTab sales={[sale]} actions={actions} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);
    await user.click(screen.getByRole("button", { name: /^generar guía$/i }));

    expect(
      screen.getByRole("heading", {
        name: "Este pedido está configurado como retiro en tienda",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(actions.onEditDeliveryType).not.toHaveBeenCalled();
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
  });

  it("un pedido PREPARADO que ya tiene guía no es elegible y la revisión lo atribuye a la guía, no a retiro", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-preparado-conguia",
      orderNumber: "ORD-CONGUIA-1",
      status: "PREPARADO",
      deliveryType: "DOMICILIO",
      guideNumber: "GUIA-123",
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);
    await user.click(
      screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Ya tiene la guía GUIA-123")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /editar entrega/i }),
    ).not.toBeInTheDocument();
  });

  it("un pedido sin tipo de entrega se informa como tal, no como retiro en tienda", async () => {
    const user = userEvent.setup();
    const sale = makeSale({ orderNumber: "ORD-SINTIPO-1", deliveryType: "" });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />, { wrapper: OrderDetailModalProvider });
    await selectLastRow(user);
    await user.click(
      screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("No tiene tipo de entrega configurado"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/retiro en tienda/i)).not.toBeInTheDocument();
  });

  it("selección mixta: lista los bloqueados con motivo, permite editar solo el de retiro y genera explícitamente para los elegibles", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const ok = makeSale({ id: "s-ok", orderNumber: "ORD-OK" });
    const retiro = makeSale({
      id: "s-retiro",
      orderNumber: "ORD-RETIRO",
      deliveryType: "RETIRO TIENDA",
    });
    const conGuia = makeSale({
      id: "s-guia",
      orderNumber: "ORD-GUIA",
      guideNumber: "GUIA-9",
    });

    render(
      <PorDespacharTab sales={[ok, retiro, conGuia]} actions={actions} />,
      { wrapper: OrderDetailModalProvider },
    );
    // Primer checkbox = "seleccionar toda la página".
    await user.click(screen.getAllByRole("checkbox")[0]);

    await user.click(
      screen.getByRole("button", { name: /generar guía \(1 de 3\)/i }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/1 de 3 pedidos pueden generar guía/i)).toBeInTheDocument();
    expect(within(dialog).getByText("ORD-RETIRO")).toBeInTheDocument();
    expect(within(dialog).getByText("Configurado como retiro en tienda")).toBeInTheDocument();
    expect(within(dialog).getByText("ORD-GUIA")).toBeInTheDocument();
    expect(within(dialog).getByText("Ya tiene la guía GUIA-9")).toBeInTheDocument();
    // Solo el de retiro tiene edición individual.
    const editButtons = within(dialog).getAllByRole("button", {
      name: /editar entrega/i,
    });
    expect(editButtons).toHaveLength(1);
    expect(editButtons[0]).toHaveAccessibleName(
      "Abrir venta para editar entrega de ORD-RETIRO",
    );
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "Generar guía para 1 pedido" }),
    );

    expect(actions.onOpenCreateGuide).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s-ok" }),
    ]);
    expect(actions.onEditDeliveryType).not.toHaveBeenCalled();
  });

  it("selección mixta: editar un pedido de retiro deriva solo ese pedido, sin cambios en bloque", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const retiroA = makeSale({ id: "s-a", orderNumber: "ORD-A", deliveryType: "RETIRO TIENDA" });
    const retiroB = makeSale({ id: "s-b", orderNumber: "ORD-B", deliveryType: "RETIRO TIENDA" });

    render(<PorDespacharTab sales={[retiroA, retiroB]} actions={actions} />, {
      wrapper: OrderDetailModalProvider,
    });
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(
      screen.getByRole("button", { name: /generar guía \(0 de 2\)/i }),
    );

    await user.click(
      screen.getByRole("button", { name: "Abrir venta para editar entrega de ORD-B" }),
    );

    expect(actions.onEditDeliveryType).toHaveBeenCalledTimes(1);
    // Se edita solo ORD-B, pero se lleva la selección completa para
    // restaurarla al volver.
    expect(actions.onEditDeliveryType).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s-b" }),
      expect.objectContaining({ selectedIds: ["s-a", "s-b"] }),
    );
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
  });

  it("al volver tras guardar con el pedido ya elegible ofrece 'Continuar con la generación' sin generar automáticamente", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const onHandled = jest.fn();
    const sale = makeSale({ id: "s-editado", orderNumber: "ORD-EDITADO", deliveryType: "DOMICILIO" });

    render(
      <PorDespacharTab
        sales={[sale]}
        actions={actions}
        guideReturn={{ selectedIds: ["s-editado"], updatedId: "s-editado", dayKey: null }}
        onGuideReturnHandled={onHandled}
      />,
      { wrapper: OrderDetailModalProvider },
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "El pedido ya puede generar guía" }),
    ).toBeInTheDocument();
    expect(onHandled).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /generar guía \(1\)/i })).toBeEnabled();

    await user.click(
      within(dialog).getByRole("button", { name: "Continuar con la generación" }),
    );

    expect(actions.onOpenCreateGuide).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s-editado" }),
    ]);
  });

  it("al volver tras guardar si el pedido sigue en retiro no ofrece continuar", async () => {
    const sale = makeSale({ id: "s-sigue", orderNumber: "ORD-SIGUE", deliveryType: "RETIRO TIENDA" });

    render(
      <PorDespacharTab
        sales={[sale]}
        actions={makeActions()}
        guideReturn={{ selectedIds: ["s-sigue"], updatedId: "s-sigue", dayKey: null }}
      />,
      { wrapper: OrderDetailModalProvider },
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "El pedido sigue configurado como retiro en tienda",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /continuar con la generación/i }),
    ).not.toBeInTheDocument();
  });

  it("al volver tras guardar conserva la selección original y recalcula la elegibilidad con los datos recargados", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    // Datos recargados: ORD-EDITADO ya es DOMICILIO; ORD-B sigue en retiro.
    const editado = makeSale({ id: "s-ed", orderNumber: "ORD-EDITADO", deliveryType: "DOMICILIO" });
    const otro = makeSale({ id: "s-b", orderNumber: "ORD-B", deliveryType: "RETIRO TIENDA" });
    const noSeleccionado = makeSale({ id: "s-x", orderNumber: "ORD-X" });

    render(
      <PorDespacharTab
        sales={[editado, otro, noSeleccionado]}
        actions={actions}
        guideReturn={{ selectedIds: ["s-ed", "s-b"], updatedId: "s-ed", dayKey: null }}
      />,
      { wrapper: OrderDetailModalProvider },
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/1 de 2 pedidos pueden generar guía/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/se guardaron los cambios de/i)).toHaveTextContent(
      "Se guardaron los cambios de ORD-EDITADO; ya puede generar guía.",
    );
    expect(within(dialog).getByText("ORD-B")).toBeInTheDocument();
    expect(within(dialog).queryByText("ORD-X")).not.toBeInTheDocument();
    // La selección restaurada es la original (2), no solo el editado.
    expect(screen.getByRole("button", { name: /generar guía \(1 de 2\)/i })).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Generar guía para 1 pedido" }),
    );
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s-ed", deliveryType: "DOMICILIO" }),
    ]);
  });

  it("al volver SIN guardar ('Volver'/cancelar) restaura la selección pero no reabre la revisión ni anuncia cambios", async () => {
    const actions = makeActions();
    const onHandled = jest.fn();
    const a = makeSale({ id: "s-a", orderNumber: "ORD-A", deliveryType: "RETIRO TIENDA" });
    const b = makeSale({ id: "s-b", orderNumber: "ORD-B" });

    render(
      <PorDespacharTab
        sales={[a, b]}
        actions={actions}
        guideReturn={{ selectedIds: ["s-a", "s-b"], updatedId: null, dayKey: null }}
        onGuideReturnHandled={onHandled}
      />,
      { wrapper: OrderDetailModalProvider },
    );

    expect(await screen.findByRole("button", { name: /generar guía \(1 de 2\)/i })).toBeInTheDocument();
    expect(onHandled).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/se guardaron los cambios/i)).not.toBeInTheDocument();
    expect(actions.onOpenCreateGuide).not.toHaveBeenCalled();
  });

  it("la revisión abierta se recalcula si llegan datos nuevos (no usa objetos viejos)", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const viejo = makeSale({ id: "s-1", orderNumber: "ORD-1", deliveryType: "RETIRO TIENDA" });

    const { rerender } = render(<PorDespacharTab sales={[viejo]} actions={actions} />, {
      wrapper: OrderDetailModalProvider,
    });
    await selectLastRow(user);
    await user.click(screen.getByRole("button", { name: /generar guía \(0 de 1\)/i }));
    expect(
      screen.getByRole("heading", { name: "Este pedido está configurado como retiro en tienda" }),
    ).toBeInTheDocument();

    const nuevo = { ...viejo, deliveryType: "DOMICILIO" };
    rerender(<PorDespacharTab sales={[nuevo]} actions={actions} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/1 de 1 pedido puede generar guía/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Generar guía para 1 pedido" }));
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s-1", deliveryType: "DOMICILIO" }),
    ]);
  });
});
