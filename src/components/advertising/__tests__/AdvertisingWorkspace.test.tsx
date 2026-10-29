import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdvertisingWorkspace } from "@/services/advertisingWorkspaceService";
import { AdvertisingAlerts } from "../AdvertisingAlerts";
import { AdvertisingAssignments } from "../AdvertisingAssignments";
import { AdvertisingPlanner } from "../AdvertisingPlanner";
import { advertisingBasisPoints, advertisingInputDecimal } from "../advertising-workspace-model";

beforeAll(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => undefined },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
  });
});

function workspace(): AdvertisingWorkspace {
  return {
    from: "2026-10-01",
    to: "2026-10-02",
    today: "2026-10-11",
    capabilities: { canConfigure: true },
    accounts: [
      {
        id: "account",
        externalId: "123",
        name: "Cuenta",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
      },
    ],
    stores: [{ id: "store", name: "Tienda Lima" }],
    channels: ["WHATSAPP"],
    assignments: [
      {
        accountId: "account",
        version: 2,
        effectiveFrom: "2026-10-01",
        shares: [{ storeId: "store", channel: null, basisPoints: 10_000 }],
      },
    ],
    allocated: {
      rows: [],
      totals: [],
      unassigned: [],
      coverage: [
        { currency: "PEN", coverage: "pending", missingAccountDays: 2, provisional: false },
      ],
    },
    alerts: [],
    rules: [],
    plans: [],
  };
}
async function select(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
}

it("keeps saved assignments readable and disables all configuration without capability", () => {
  const data = workspace();
  data.capabilities.canConfigure = false;
  const onSave = jest.fn();
  render(<AdvertisingAssignments workspace={data} busy={false} onSave={onSave} />);
  expect(screen.getByText("Asignaciones guardadas")).toBeVisible();
  expect(screen.getByText(/Tienda Lima · Sin canal · 100 %/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeDisabled();
  expect(screen.getByText(/Datos pendientes/)).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
});

it("submits exact weights, current company stores and the version originally reviewed", async () => {
  const data = workspace();
  const onSave = jest.fn().mockResolvedValue(true);
  const { rerender } = render(
    <AdvertisingAssignments workspace={data} busy={false} onSave={onSave} />,
  );
  await select("Cuenta Meta", "Cuenta · PEN");
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Motivo del cambio"), "Nueva distribución");
  rerender(
    <AdvertisingAssignments
      workspace={{ ...data, assignments: [{ ...data.assignments[0], version: 3 }] }}
      busy={false}
      onSave={onSave}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Guardar asignación" }));
  expect(onSave).toHaveBeenCalledWith("account", {
    expectedVersion: 2,
    effectiveFrom: "2026-10-11",
    reason: "Nueva distribución",
    shares: [{ storeId: "store", channel: null, basisPoints: 10_000 }],
  });
});

it("rejects a partial or repeated assignment instead of duplicating company spend", async () => {
  const onSave = jest.fn();
  render(<AdvertisingAssignments workspace={workspace()} busy={false} onSave={onSave} />);
  await select("Cuenta Meta", "Cuenta · PEN");
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Porcentaje"));
  await user.type(screen.getByLabelText("Porcentaje"), "99,99");
  await user.type(screen.getByLabelText("Motivo del cambio"), "Cambio de reparto");
  await user.click(screen.getByRole("button", { name: "Guardar asignación" }));
  expect(screen.getByRole("alert")).toHaveTextContent("exactamente el 100");
  expect(onSave).not.toHaveBeenCalled();
});

it("saves a real threshold rule with exact decimal and explicit enabled state", async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  render(
    <AdvertisingAlerts
      workspace={workspace()}
      busy={false}
      onSave={onSave}
      onEvaluate={jest.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), "Límite Meta");
  await select("Moneda", "PEN");
  await user.type(screen.getByLabelText("Límite de gasto"), "0,000000000001");
  await user.click(screen.getByRole("button", { name: "Guardar regla" }));
  expect(onSave).toHaveBeenCalledWith(null, {
    name: "Límite Meta",
    accountId: null,
    currency: "PEN",
    threshold: "0.000000000001",
    enabled: true,
    expectedVersion: 0,
  });
});

it("saves a budget scenario only with a complete same-currency distribution", async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  render(<AdvertisingPlanner workspace={workspace()} busy={false} onSave={onSave} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), "Prueba octubre");
  await select("Moneda", "PEN");
  await user.type(screen.getByLabelText("Presupuesto total"), "100,005");
  await user.click(screen.getByRole("button", { name: "Añadir cuenta" }));
  await select("Cuenta Meta", "Cuenta");
  await user.click(screen.getByRole("button", { name: "Guardar escenario" }));
  expect(onSave).toHaveBeenCalledWith({
    name: "Prueba octubre",
    from: "2026-10-01",
    to: "2026-10-02",
    currency: "PEN",
    budget: "100.005",
    targets: [{ accountId: "account", basisPoints: 10_000 }],
  });
  expect(screen.getByText(/no modifica campañas ni predice ventas/)).toBeVisible();
});

it("calculates percentage basis points without binary rounding or unknown amounts becoming zero", () => {
  expect(advertisingBasisPoints("33,33")).toBe(3333);
  expect(advertisingBasisPoints("66.67")).toBe(6667);
  expect(advertisingBasisPoints("100.01")).toBeNull();
  expect(advertisingBasisPoints("0")).toBeNull();
  expect(advertisingInputDecimal("")).toBeNull();
  expect(advertisingInputDecimal("0")).toBe("0");
});

it("ofrece asignar tienda desde r9 y distingue el importe Meta del total efectivo", () => {
  const data = workspace();
  data.alerts = [
    {
      id: "r9:account:adset:PEN",
      kind: "unassigned-store",
      code: "UNASSIGNED_SPEND_OVER_24H",
      accountId: "account",
      adsetId: "adset",
      title: "Gasto sin tienda",
      message: "Asigna una tienda a este conjunto.",
      currency: "PEN",
      amount: "12.50",
      amountSource: "meta-imported",
    },
  ];
  render(
    <AdvertisingAlerts workspace={data} busy={false} onSave={jest.fn()} onEvaluate={jest.fn()} />,
  );
  expect(screen.getByRole("link", { name: "Asignar tienda" })).toHaveAttribute(
    "href",
    "/publicidad/asignaciones?from=2026-10-01&to=2026-10-02&accountId=account&storeId=all",
  );
  expect(screen.getByText(/Gasto importado de Meta:/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Reconectar" })).not.toBeInTheDocument();
});
