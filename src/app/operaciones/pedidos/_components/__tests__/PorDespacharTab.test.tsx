/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: PorDespacharTab — habilitación de "Generar guía" para pedidos PAGADO.
 *
 * Bug corregido: un pedido en `status: "PAGADO"` ("PENDIENTE + cobrado al
 * 100%"), a domicilio y sin guía, no se podía asignar a guía desde
 * /operaciones/pedidos. La corrección agrega `"PAGADO"` a
 * `GUIDE_ELIGIBLE_STATUSES`; los handlers de creación de guía encadenan los
 * PATCH intermedios (PREPARADO → LLAMADO → ASIGNADO_A_GUIA) de forma
 * transparente.
 *
 * Estos tests verifican el comportamiento observable de la pestaña:
 *  - al seleccionar un pedido PAGADO elegible, "Generar guía (1)" queda
 *    habilitado y al confirmarlo se pasa ese pedido a `onOpenCreateGuide`.
 *  - un pedido PENDIENTE (no elegible) deja el botón en "(0)" y muestra el
 *    aviso de "no se pueden incluir en una guía".
 *  - la elegibilidad sigue exigiendo entrega a DOMICILIO y ausencia de guía.
 *
 * Work-arounds jsdom / mocks: se reemplazan las primitivas de UI (button,
 * table, checkbox, popover, calendar, select, tooltip), los helpers de export
 * (xlsx / file-saver), los iconos (lucide-react) y los componentes hijos
 * pesados (SalesTableFilters, BulkStatusSelect, SourceBadge) por stubs
 * mínimos. `applyFilters` / `emptySalesFilters` se mantienen reales.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
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
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    type?: "button" | "submit" | "reset";
  }) =>
    R.createElement(
      "button",
      { onClick, disabled: !!disabled, title, type: type ?? "button" },
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
    status: "PAGADO" as OrderStatus,
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
    onView: jest.fn(),
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

describe("PorDespacharTab — armado de guía desde PAGADO", () => {
  it("un pedido PAGADO a domicilio y sin guía, al seleccionarlo, habilita 'Generar guía (1)'", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-pagado-1",
      orderNumber: "ORD-PAGADO-1",
      status: "PAGADO",
      deliveryType: "DOMICILIO",
      guideNumber: null,
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />);

    expect(screen.getByText("ORD-PAGADO-1")).toBeInTheDocument();

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

  it("al confirmar 'Generar guía' pasa el pedido PAGADO a onOpenCreateGuide", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    const sale = makeSale({ id: "sale-pagado-1", status: "PAGADO" });

    render(<PorDespacharTab sales={[sale]} actions={actions} />);
    await selectLastRow(user);

    await user.click(
      screen.getByRole("button", { name: /generar guía \(1\)/i }),
    );

    expect(actions.onOpenCreateGuide).toHaveBeenCalledTimes(1);
    expect(actions.onOpenCreateGuide).toHaveBeenCalledWith([
      expect.objectContaining({ id: "sale-pagado-1", status: "PAGADO" }),
    ]);
  });

  it("sin selección, el botón 'Generar Guía' de la cabecera está deshabilitado", () => {
    render(<PorDespacharTab sales={[makeSale()]} actions={makeActions()} />);

    expect(
      screen.getByRole("button", { name: /generar guía/i }),
    ).toBeDisabled();
  });

  it("un pedido PENDIENTE seleccionado deja 'Generar guía (0)' y muestra el aviso de estado no elegible", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-pendiente-1",
      orderNumber: "ORD-PEND-1",
      status: "PENDIENTE",
      deliveryType: "DOMICILIO",
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />);
    await selectLastRow(user);

    expect(
      screen.getByRole("button", { name: /generar guía \(0\)/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        /pedido\(s\) seleccionados no se pueden incluir en una guía/i,
      ),
    ).toBeInTheDocument();
  });

  it("un pedido PAGADO con entrega en tienda no es elegible (sin aviso: el estado sí es válido, falla el tipo de entrega)", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-pagado-retiro",
      orderNumber: "ORD-RETIRO-1",
      status: "PAGADO",
      deliveryType: "RETIRO TIENDA",
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />);
    await selectLastRow(user);

    expect(
      screen.getByRole("button", { name: /generar guía \(0\)/i }),
    ).toBeDisabled();
    expect(
      screen.queryByText(
        /pedido\(s\) seleccionados no se pueden incluir en una guía/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("un pedido PAGADO que ya tiene guía no vuelve a ser elegible para generar guía", async () => {
    const user = userEvent.setup();
    const sale = makeSale({
      id: "sale-pagado-conguia",
      orderNumber: "ORD-CONGUIA-1",
      status: "PAGADO",
      deliveryType: "DOMICILIO",
      guideNumber: "GUIA-123",
    });

    render(<PorDespacharTab sales={[sale]} actions={makeActions()} />);
    await selectLastRow(user);

    expect(
      screen.getByRole("button", { name: /generar guía \(0\)/i }),
    ).toBeDisabled();
  });
});
