/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: TransitTab — En camino y Despachados.
 *
 * - ASIGNADO_A_GUIA (guía por aprobar) muestra "Aprobar guía"; "Despachar" aplica solo a EN_ENVIO.
 * - "Entregado" queda en el menú ⋮ de las filas EN_ENVIO y no en las ASIGNADO.
 * - Despachados tiene el botón "Entregado" y los filtros rápidos de tracking.
 * - La etiqueta de estado coincide con la pestaña y solo avisa lo que el courier realmente reportó.
 * - La vista por guía pagina por guía y sus acciones dependen de los estados de la guía.
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
      "data-testid": testId,
    }: {
      children?: React.ReactNode;
      colSpan?: number;
      "data-testid"?: string;
    }) =>
      R.createElement(tag, { colSpan, "data-testid": testId }, children);
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


jest.mock("@/components/ui/dropdown-menu", () => {
  const R = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) => R.createElement("div", null, children);
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuSeparator: () => null,
    DropdownMenuLabel: Pass,
    DropdownMenuItem: ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
      R.createElement("button", { onClick, disabled: !!disabled, role: "menuitem" }, children),
  };
});
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: ["store-a"], canFetch: true }) }));
jest.mock("@/hooks/useOperationsPedidos", () => ({
  ...jest.requireActual("@/hooks/useOperationsPedidos"),
  useVisibleSelection: () => ({ visibleIds: null, loading: false }),
}));

// ── Imports bajo prueba (después de los mocks) ──────────────────────────────

import { TransitTab, courierNotice, stageLabel } from "../TransitTab";
import { OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import { emptyTabState, type OperationsTabData } from "../tabState";
import type { OperationsGuideGroup } from "@/services/operationsPedidosService";
import type { PedidosActions, Sale } from "../types";
import type { OrderStatus } from "@/interfaces/IOrder";

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const nowIso = new Date().toISOString();
  return {
    id: "sale-1", customerId: "cust-1", orderNumber: "ORD-0001", clientName: "Juan Pérez", phoneNumber: "999111222",
    date: "01/01/2026", total: 150, status: "EN_ENVIO" as OrderStatus, paymentMethod: "EFECTIVO", deliveryType: "DOMICILIO",
    salesRegion: "LIMA", district: "Miraflores", address: "Av. Test 123", advancePayment: 150, pendingPayment: 0, notes: "",
    guideNumber: "G-1", courier: "Shalom", hasPendingApprovalPayments: false, sellerName: null, createdAt: nowIso, updatedAt: nowIso,
    callbackAt: null, items: [], ...overrides,
  };
}

function makeActions(overrides: Partial<PedidosActions> = {}): PedidosActions {
  return {
    can: jest.fn().mockReturnValue(true), apiCouriers: [], salesChannels: [], isBulkLoading: false,
    onOpenGuide: jest.fn(), onChangeStatus: jest.fn(), onBulkStatusChange: jest.fn(), onBulkWhatsApp: jest.fn(),
    onCopySelected: jest.fn(), onExportExcel: jest.fn(), onWhatsApp: jest.fn(), onSyncCourier: jest.fn(),
    loadSalesByIds: jest.fn(async (ids: string[]) => ids.map((id) => makeSale({ id }))),
    ...overrides,
  } as unknown as PedidosActions;
}

function makeGroup(overrides: Partial<OperationsGuideGroup> = {}): OperationsGuideGroup {
  return {
    guideNumber: "G-1", courier: "Shalom", orders: 2, orderIds: ["o-1", "o-2"], orderNumbers: ["ORD-1", "ORD-2"],
    statuses: ["EN_ENVIO"], zones: [], pending: 0, departedAt: "2026-10-30T10:00:00.000Z", hasIncidents: false, allDeliveredByCourier: false,
    ...overrides,
  };
}

function renderTab(
  variant: "camino" | "despachados",
  sales: Sale[],
  extra: { actions?: PedidosActions; onState?: jest.Mock; state?: ReturnType<typeof emptyTabState>; data?: Partial<OperationsTabData> } = {},
) {
  const onState = extra.onState ?? jest.fn();
  const state = extra.state ?? emptyTabState();
  const data: OperationsTabData = { sales, total: sales.length, totalPages: 1, loading: false, fetching: false, ...extra.data };
  const actions = extra.actions ?? makeActions();
  render(
    <TransitTab variant={variant} data={data} state={state} query={{ tab: variant === "camino" ? "en-camino" : "despachados", page: 1, limit: 15, filters: state.filters }}
      onState={onState} actions={actions} />,
    { wrapper: OrderDetailModalProvider },
  );
  return { onState, actions };
}

const rowOf = (orderNumber: string) => screen.getByText(orderNumber).closest("tr") as HTMLElement;

describe("TransitTab — En camino: acciones por estado", () => {
  it("un ASIGNADO_A_GUIA muestra 'Aprobar guía' (abre la guía) y nunca 'Despachar' ni 'Entregado'", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("camino", [makeSale({ id: "a", orderNumber: "ORD-A", status: "ASIGNADO_A_GUIA" })]);
    const row = rowOf("ORD-A");

    expect(within(row).queryByRole("button", { name: /^despachar$/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: /entregado/i })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /aprobar guía/i }));

    expect(actions.onOpenGuide).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(actions.onChangeStatus).not.toHaveBeenCalled();
  });

  it("un EN_ENVIO muestra 'Despachar' y deja 'Entregado' en el menú ⋮", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("camino", [makeSale({ id: "e", orderNumber: "ORD-E", status: "EN_ENVIO" })]);
    const row = rowOf("ORD-E");

    expect(within(row).queryByRole("button", { name: /aprobar guía/i })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /^despachar$/i }));
    expect(actions.onChangeStatus).toHaveBeenLastCalledWith("e", "DESPACHADO");

    await user.click(within(row).getByRole("menuitem", { name: /entregado/i }));
    expect(actions.onChangeStatus).toHaveBeenLastCalledWith("e", "ENTREGADO");
  });

  it("sin permiso de cambiar estado no hay botones de avance", () => {
    const actions = makeActions({ can: jest.fn((permission: string) => permission !== "OPS_CHANGE_STATUS_MANUAL") as never });
    renderTab("camino", [makeSale({ orderNumber: "ORD-E" })], { actions });
    const row = rowOf("ORD-E");

    expect(within(row).queryByRole("button", { name: /^despachar$/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: /entregado/i })).not.toBeInTheDocument();
  });

  it("'Aprobar guía' queda deshabilitado sin el permiso de gestionar guías", () => {
    const actions = makeActions({ can: jest.fn((permission: string) => permission !== "OPS_MANAGE_GUIDES") as never });
    renderTab("camino", [makeSale({ orderNumber: "ORD-A", status: "ASIGNADO_A_GUIA" })], { actions });

    expect(within(rowOf("ORD-A")).getByRole("button", { name: /aprobar guía/i })).toBeDisabled();
  });
});

describe("TransitTab — Despachados", () => {
  it("cada fila tiene el botón 'Entregado' y no hay botón Despachar ni Aprobar guía", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("despachados", [makeSale({ id: "d", orderNumber: "ORD-D", status: "DESPACHADO" })]);
    const row = rowOf("ORD-D");

    expect(within(row).queryByRole("button", { name: /despachar|aprobar/i })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /^entregado$/i }));
    expect(actions.onChangeStatus).toHaveBeenCalledWith("d", "ENTREGADO");
  });

  it("los filtros rápidos de tracking piden `quick` al servidor", async () => {
    const user = userEvent.setup();
    const { onState } = renderTab("despachados", [makeSale({ status: "DESPACHADO" })]);

    await user.click(screen.getByRole("button", { name: /agencia por vencer/i }));
    expect(onState).toHaveBeenLastCalledWith({ quick: "agencia-por-vencer" });
    await user.click(screen.getByRole("button", { name: /por confirmar entrega/i }));
    expect(onState).toHaveBeenLastCalledWith({ quick: "por-confirmar" });
  });

  it("En camino no ofrece los filtros rápidos de tracking", () => {
    renderTab("camino", [makeSale()]);
    expect(screen.queryByRole("button", { name: /agencia por vencer/i })).not.toBeInTheDocument();
  });
});

describe("TransitTab — etiquetas de estado", () => {
  it("el estado se nombra como la pestaña: Guía por aprobar, En camino, Despachado", () => {
    expect(stageLabel("ASIGNADO_A_GUIA").label).toBe("Guía por aprobar");
    expect(stageLabel("EN_ENVIO").label).toBe("En camino");
    expect(stageLabel("DESPACHADO").label).toBe("Despachado");
  });

  it("nunca muestra un 'En tránsito' por defecto: solo lo que el courier reportó", () => {
    expect(courierNotice({ shalomStatus: null })).toBeNull();
    expect(courierNotice({ shalomStatus: "EN_TRANSITO" })).toBeNull();
    expect(courierNotice({ shalomStatus: "EN_DESTINO" })?.label).toBe("En agencia");
    expect(courierNotice({ shalomStatus: "ENTREGADO" })?.label).toBe("Por confirmar");

    renderTab("camino", [makeSale({ orderNumber: "ORD-1", status: "EN_ENVIO", shalomStatus: null })]);
    const row = rowOf("ORD-1");
    expect(within(row).getByText("En camino")).toBeInTheDocument();
    expect(within(row).queryByText(/en tránsito/i)).not.toBeInTheDocument();
  });

  it("junto a la etiqueta del estado aparece el aviso del courier cuando lo hay", () => {
    renderTab("despachados", [makeSale({ orderNumber: "ORD-2", status: "DESPACHADO", shalomStatus: "EN_DESTINO" })]);
    const row = rowOf("ORD-2");

    expect(within(row).getByText("Despachado")).toBeInTheDocument();
    expect(within(row).getByText("En agencia")).toBeInTheDocument();
  });
});

describe("TransitTab — vista por guía (paginada en servidor)", () => {
  const guideState = () => ({ ...emptyTabState(), view: "guia" as const });

  it("el interruptor Por pedido / Por guía pide la vista al servidor", async () => {
    const user = userEvent.setup();
    const { onState } = renderTab("camino", [makeSale()]);

    await user.click(screen.getByRole("button", { name: "Por guía" }));
    expect(onState).toHaveBeenLastCalledWith({ view: "guia" });
  });

  it("muestra una fila por guía, 'N guías · M pedidos' en el encabezado y pagina por guías", async () => {
    const user = userEvent.setup();
    const { onState } = renderTab("camino", [], {
      state: guideState(),
      data: { groups: [makeGroup(), makeGroup({ guideNumber: "G-2", orders: 1, orderIds: ["o-3"], orderNumbers: ["ORD-3"] })], total: 31, totalOrders: 58, totalPages: 3 },
    });

    expect(screen.getByTestId("tab-total-badge")).toHaveTextContent("31 guías · 58 pedidos");
    expect(screen.getAllByTestId("guide-row")).toHaveLength(2);
    expect(screen.getByText(/mostrando 1 – 15 de 31 guías/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Página 2" }));
    expect(onState).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("En camino: una guía con pedidos por aprobar ofrece 'Aprobar guía'; una toda EN_ENVIO ofrece 'Despachar guía'", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("camino", [], {
      state: guideState(),
      data: { groups: [makeGroup({ guideNumber: "G-APR", statuses: ["ASIGNADO_A_GUIA", "EN_ENVIO"] }), makeGroup({ guideNumber: "G-ENV", statuses: ["EN_ENVIO"], orderIds: ["x", "y"] })], total: 2, totalOrders: 4 },
    });
    const [aprobar, despachar] = screen.getAllByTestId("guide-row");

    expect(within(aprobar).queryByRole("button", { name: /despachar guía/i })).not.toBeInTheDocument();
    expect(within(despachar).queryByRole("button", { name: /aprobar guía/i })).not.toBeInTheDocument();
    await user.click(within(despachar).getByRole("button", { name: /despachar guía/i }));
    expect(actions.onBulkStatusChange).toHaveBeenCalledWith(["x", "y"], "DESPACHADO");
    await user.click(within(aprobar).getByRole("button", { name: /aprobar guía/i }));
    expect(actions.onOpenGuide).toHaveBeenCalledWith(expect.objectContaining({ id: "o-1" }));
  });

  it("Despachados: la guía ofrece 'Marcar entregada' y el estado refleja incidencias o entrega pendiente de confirmar", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("despachados", [], {
      state: guideState(),
      data: { groups: [makeGroup({ guideNumber: "G-OK", statuses: ["DESPACHADO"], orderIds: ["p", "q"], allDeliveredByCourier: true }), makeGroup({ guideNumber: "G-BAD", hasIncidents: true })], total: 2, totalOrders: 4 },
    });
    const [ok, bad] = screen.getAllByTestId("guide-row");

    expect(within(ok).getByText("Por confirmar")).toBeInTheDocument();
    expect(within(bad).getByText("Con incidencias")).toBeInTheDocument();
    await user.click(within(ok).getByRole("button", { name: /marcar entregada/i }));
    expect(actions.onBulkStatusChange).toHaveBeenCalledWith(["p", "q"], "ENTREGADO");
  });

  it("los pedidos sin guía forman un grupo 'Sin guía' sin acciones de avance", () => {
    renderTab("camino", [], {
      state: guideState(),
      data: { groups: [makeGroup({ guideNumber: "", orders: 1, orderIds: ["z"], orderNumbers: ["ORD-Z"] })], total: 1, totalOrders: 1 },
    });
    const row = screen.getByTestId("guide-row");

    expect(within(row).getByText("Sin guía")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /aprobar|despachar|entregada/i })).not.toBeInTheDocument();
  });

  it("el WhatsApp masivo de una guía pide primero sus pedidos al servidor", async () => {
    const user = userEvent.setup();
    const { actions } = renderTab("camino", [], { state: guideState(), data: { groups: [makeGroup({ orderIds: ["o-1", "o-2"] })], total: 1, totalOrders: 2 } });

    await user.click(within(screen.getByTestId("guide-row")).getByRole("button", { name: /whatsapp masivo/i }));

    expect(actions.loadSalesByIds).toHaveBeenCalledWith(["o-1", "o-2"]);
    expect(actions.onBulkWhatsApp).toHaveBeenCalledWith([expect.objectContaining({ id: "o-1" }), expect.objectContaining({ id: "o-2" })]);
  });
});
