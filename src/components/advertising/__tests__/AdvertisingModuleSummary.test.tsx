import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvertisingConnections, AdvertisingDashboard } from "../AdvertisingDashboard";
import { AdvertisingModuleSummary } from "../AdvertisingModuleSummary";
import type { AdvertisingSnapshot } from "../advertising-model";

jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));

function snapshot(): AdvertisingSnapshot {
  return {
    accounts: [
      {
        id: "meta-account",
        provider: "meta",
        name: "Cuenta Lima",
        externalId: "123456",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        updatedAt: null,
        historyImport: {
          id: "job",
          status: "succeeded",
          availableFrom: "2026-05-08",
          availableTo: "2026-10-10",
          completedWindows: 6,
          totalWindows: 6,
          errorCode: null,
        },
      },
    ],
    days: [
      { accountId: "meta-account", date: "2026-01-01", amountMinor: 1250, amountDecimal: "12.50" },
    ],
    manualRecords: [],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: false, status: "disconnected" },
    },
    today: "2026-10-10",
  };
}

it("uses saved coverage before a newly discovered provider history boundary", () => {
  render(
    <AdvertisingModuleSummary
      companyName="Empresa"
      from="2026-01-01"
      to="2026-01-01"
      snapshot={snapshot()}
    />,
  );
  expect(screen.getAllByText("Datos completos")).toHaveLength(2);
  expect(screen.queryByText(/Fuera del historial/)).not.toBeInTheDocument();
  expect(screen.getAllByText(/12.50/)).toHaveLength(2);
  expect(screen.queryByText("Importación del historial")).not.toBeInTheDocument();
});

it("keeps the legacy January ledger complete after Meta discovers availability from May", () => {
  const data = snapshot();
  data.days = Array.from({ length: 31 }, (_, index) => ({
    accountId: "meta-account",
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    amountMinor: 100,
    amountDecimal: "1.00",
  }));
  render(
    <AdvertisingDashboard
      companyName="Empresa"
      from="2026-01-01"
      to="2026-01-31"
      snapshot={data}
    />,
  );
  expect(screen.getByText("Historial disponible importado")).toBeVisible();
  expect(screen.queryByText("Historial no disponible")).not.toBeInTheDocument();
  expect(screen.queryByText(/Disponible desde/)).not.toBeInTheDocument();
  const table = screen.getByRole("table", { name: "Gasto por cuenta publicitaria" });
  expect(within(table).getByText("Datos completos")).toBeVisible();
  expect(within(table).getByText(/31.00/)).toBeVisible();
});

it("shows unavailable history without turning missing data into zero or pending imports", () => {
  render(
    <AdvertisingModuleSummary
      companyName="Empresa"
      from="2025-01-01"
      to="2025-01-01"
      snapshot={snapshot()}
    />,
  );
  expect(screen.getByText("Fuera del historial")).toBeVisible();
  expect(screen.getByText("Fuera del historial disponible")).toBeVisible();
  expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
  expect(screen.queryByText(/0.00/)).not.toBeInTheDocument();
});

it("preserves exact saved amounts outside the safe integer range and history boundary", () => {
  const data = snapshot();
  data.days[0] = { ...data.days[0], amountMinor: null, amountDecimal: "1000000000000000000.01" };
  const { rerender } = render(
    <AdvertisingModuleSummary
      companyName="Empresa"
      from="2026-01-01"
      to="2026-01-01"
      snapshot={data}
    />,
  );
  expect(screen.queryByText(/Fuera del historial/)).not.toBeInTheDocument();
  expect(screen.getAllByText(/1,000,000,000,000,000,000.01/)).toHaveLength(2);
  rerender(
    <AdvertisingConnections snapshot={data} showAccounts from="2026-01-01" to="2026-01-02" />,
  );
  const account = screen.getByRole("region", { name: "Cuenta Cuenta Lima" });
  expect(within(account).getByText("Datos parciales")).toBeVisible();
  expect(within(account).queryByText("Datos pendientes")).not.toBeInTheDocument();
});

it("keeps currencies separate and does not infer attributed business results", () => {
  const data = snapshot();
  data.accounts.push({
    ...data.accounts[0],
    id: "usd-account",
    name: "Cuenta dólar",
    externalId: "777",
    currency: "USD",
    historyImport: null,
  });
  data.days.push({
    accountId: "usd-account",
    date: "2026-01-01",
    amountMinor: 350,
    amountDecimal: "3.50",
  });
  render(
    <AdvertisingModuleSummary
      companyName="Empresa"
      from="2026-01-01"
      to="2026-01-01"
      snapshot={data}
    />,
  );
  expect(screen.getByText("Gasto importado · PEN")).toBeVisible();
  expect(screen.getByText("Gasto importado · USD")).toBeVisible();
  expect(screen.queryByText(/16.00|ROAS|Ganancia|Costo por entregado/)).not.toBeInTheDocument();
});

it("shows real account details and marks a partial period without granting management actions", () => {
  render(
    <AdvertisingConnections snapshot={snapshot()} showAccounts from="2026-01-01" to="2026-01-02" />,
  );
  const account = screen.getByRole("region", { name: "Cuenta Cuenta Lima" });
  expect(within(account).getByText("ID 123456")).toBeVisible();
  expect(within(account).getByText("America/Lima")).toBeVisible();
  expect(within(account).getByText("Datos parciales")).toBeVisible();
  expect(within(account).getByText(/Gasto del.*2026.*2026/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Elegir cuentas" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Pausar actualizaciones" })).toBeDisabled();
});

it("loads manual review only when the user opens it", async () => {
  render(
    <AdvertisingModuleSummary
      companyName="Empresa"
      from="2026-01-01"
      to="2026-01-01"
      snapshot={snapshot()}
      manualReviewContent={<p>Revisión manual disponible</p>}
    />,
  );
  expect(screen.queryByText("Revisión manual disponible")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByText("Consumo total y gastos manuales"));
  expect(await screen.findByText("Revisión manual disponible")).toBeVisible();
});
