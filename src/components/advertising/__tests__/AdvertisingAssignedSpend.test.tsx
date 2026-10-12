import { render, screen, within } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingWorkspace } from "@/hooks/useAdvertisingWorkspace";
import type { AdvertisingWorkspace } from "@/services/advertisingWorkspaceService";
import { AdvertisingAssignedSpend } from "../AdvertisingAssignedSpend";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useAdvertisingWorkspace", () => ({ useAdvertisingWorkspace: jest.fn() }));
const read = jest.mocked(useAdvertisingWorkspace);
function workspace(): AdvertisingWorkspace {
  return {
    from: "2026-10-01",
    to: "2026-10-02",
    today: "2026-10-11",
    capabilities: { canConfigure: false },
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
    stores: [
      { id: "lima", name: "Tienda Lima" },
      { id: "callao", name: "Tienda Callao" },
    ],
    channels: ["WHATSAPP"],
    assignments: [],
    allocated: {
      rows: [],
      totals: [
        { storeId: "lima", channel: null, currency: "PEN", amount: "100.005" },
        { storeId: "lima", channel: "WHATSAPP", currency: "PEN", amount: "1.005" },
        { storeId: "callao", channel: "WHATSAPP", currency: "USD", amount: "9.00" },
      ],
      unassigned: [{ accountId: "account", currency: "PEN", amount: "20" }],
      coverage: [
        { currency: "PEN", coverage: "partial", missingAccountDays: 1, provisional: false },
        { currency: "USD", coverage: "complete", missingAccountDays: 0, provisional: false },
      ],
    },
    rules: [],
    alerts: [],
    plans: [],
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" },
    hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
  read.mockReturnValue({
    data: workspace(),
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useAdvertisingWorkspace>);
});

it("uses the same tenant and dates and sums exact assigned amounts by currency before presentation", () => {
  render(<AdvertisingAssignedSpend from="2026-10-01" to="2026-10-02" />);
  expect(read).toHaveBeenCalledWith({
    actorId: "actor",
    companyId: "company",
    token: "token",
    from: "2026-10-01",
    to: "2026-10-02",
    enabled: true,
  });
  expect(screen.getByText("Gasto asignado · PEN")).toBeVisible();
  expect(screen.getByText("Gasto asignado · USD")).toBeVisible();
  expect(screen.getByText(/101.01/)).toBeVisible();
  expect(screen.getByText("Datos parciales")).toBeVisible();
  expect(screen.getByRole("link", { name: "Ver asignaciones" })).toHaveAttribute(
    "href",
    "/publicidad/asignaciones?from=2026-10-01&to=2026-10-02",
  );
});

it("keeps company unassigned spend separate from one store instead of copying it into store totals", () => {
  render(<AdvertisingAssignedSpend from="2026-10-01" to="2026-10-02" storeId="lima" />);
  const table = screen.getByRole("table", { name: "Gasto asignado por tienda y canal" });
  expect(within(table).queryByText("Tienda Callao")).not.toBeInTheDocument();
  expect(screen.queryByText("Gasto asignado · USD")).not.toBeInTheDocument();
  const unassigned = screen.getByRole("region", { name: "Gasto de empresa sin asignación" });
  expect(within(unassigned).getByText(/20.00/)).toBeVisible();
  expect(screen.queryByText(/121.01/)).not.toBeInTheDocument();
});

it("does not request or display finance data without VIEW_FINANCES", () => {
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" },
    hasPermission: () => false,
  } as unknown as ReturnType<typeof useAuth>);
  render(<AdvertisingAssignedSpend from="2026-10-01" to="2026-10-02" />);
  expect(read).not.toHaveBeenCalled();
  expect(screen.queryByText("Gasto de publicidad asignado")).not.toBeInTheDocument();
});

it("marks covered provisional data as provisional instead of complete", () => {
  const data = workspace();
  data.allocated.coverage[1].provisional = true;
  read.mockReturnValue({ data, isError: false } as unknown as ReturnType<
    typeof useAdvertisingWorkspace
  >);
  render(<AdvertisingAssignedSpend from="2026-10-01" to="2026-10-02" />);
  expect(screen.getByText("Datos provisionales")).toBeVisible();
  expect(screen.queryByText("Datos completos")).not.toBeInTheDocument();
  expect(screen.getByText("Los datos provisionales pueden cambiar.")).toBeVisible();
});

it("shows pending coverage without asserting that there is no assigned spending", () => {
  const data = workspace();
  data.allocated.totals = [];
  data.allocated.coverage = [
    { currency: "PEN", coverage: "pending", missingAccountDays: 2, provisional: false },
  ];
  read.mockReturnValue({ data, isError: false } as unknown as ReturnType<
    typeof useAdvertisingWorkspace
  >);
  render(<AdvertisingAssignedSpend from="2026-10-01" to="2026-10-02" />);
  expect(screen.getByText(/La importación del periodo está incompleta/)).toBeVisible();
  expect(screen.getByText(/PEN · Datos pendientes · Faltan 2 días de cuenta/)).toBeVisible();
  expect(screen.queryByText(/No hay gasto asignado para estas tiendas/)).not.toBeInTheDocument();
});
