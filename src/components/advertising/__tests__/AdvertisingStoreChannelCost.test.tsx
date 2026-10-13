import { render, screen, within } from "@testing-library/react";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import { AdvertisingApiError } from "@/services/advertisingService";
import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import { AdvertisingStoreChannelCost } from "../AdvertisingStoreChannelCost";
import { businessV11, summaryV11 } from "./advertising-v11-fixtures";

jest.mock("@/hooks/useAdvertisingBusinessMetrics", () => ({
  useAdvertisingBusinessMetrics: jest.fn(),
}));

const useMetrics = useAdvertisingBusinessMetrics as jest.Mock;

function fixture() {
  const summary = summaryV11();
  summary.storeId = "store-a";
  summary.channelDaily = [
    {
      date: summary.from,
      accountId: "account-a",
      storeId: "store-a",
      channelId: "channel-a",
      currency: "PEN",
      spend: "100.10",
      provisional: false,
      coverage: "complete",
    },
  ];
  summary.byAccount = [
    { accountId: "account-a", currency: "PEN", timeZone: "America/Lima" },
  ] as AdvertisingSummaryV11["byAccount"];
  const business = { ...businessV11(), storeId: "store-a", channelId: "channel-a" };
  const store = { ...business, channelId: "all" };
  useMetrics.mockImplementation((_identity, filters) => ({
    data: filters.channelId === "all" ? store : business,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }));
  return { summary: { ...summary, channelDaily: summary.channelDaily }, business, store };
}

function show(summary: AdvertisingSummaryV11) {
  return render(
    <AdvertisingStoreChannelCost
      identity={{ actorId: "actor-a", companyId: "company-a", token: "test-token" }}
      summary={summary}
      storeName="Centro"
      channelName="Web"
      channelId="channel-a"
    />,
  );
}

function metric(label: string) {
  const container = screen.getByText(label, { selector: "dt" }).parentElement;
  if (!container) throw new Error("No se encontró la celda de la métrica");
  return within(container);
}

beforeEach(() => useMetrics.mockReset());

it.each(["partial", "missing", "provisional"] as const)(
  "muestra entregados conocidos con gasto %s y el costo pendiente con su motivo",
  (state) => {
    const { summary } = fixture();
    if (state === "partial") summary.currencies[0].coverage = "partial";
    if (state === "missing") summary.currencies = [];
    if (state === "provisional") summary.channelDaily[0].provisional = true;
    show(summary);

    const delivered = metric("Entregados");
    expect(delivered.getByText("10")).toBeVisible();
    expect(delivered.getByText("Confirmados")).toBeVisible();
    expect(metric("Costo por entregado").getByText("No disponible")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      state === "provisional" ? "Gasto del canal por confirmar" : "Gasto por completar",
    );
  },
);

it("muestra el conteo parcial con una explicación y no calcula el costo", () => {
  const { summary, business } = fixture();
  business.coverage = { complete: false, reasons: ["missing-delivered-date"] };
  show(summary);

  const delivered = metric("Entregados");
  expect(delivered.getByText("10")).toBeVisible();
  expect(delivered.getByText("Datos parciales")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Entregas por completar");
  expect(metric("Costo por entregado").getByText("No disponible")).toBeVisible();
});

it("muestra cero conocido y mantiene el costo sin cociente", () => {
  const { summary, business } = fixture();
  business.currencies[0].deliveredCount = 0;
  show(summary);

  const delivered = metric("Entregados");
  expect(delivered.getByText("0")).toBeVisible();
  expect(delivered.getByText("Confirmados")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Sin entregados comparables");
});

it("no presenta conteos de un periodo distinto como confirmados", () => {
  const { summary, business } = fixture();
  business.from = "2026-09-01";
  show(summary);

  const delivered = metric("Entregados");
  expect(delivered.getByText("Pendiente")).toBeVisible();
  expect(delivered.queryByText("10")).not.toBeInTheDocument();
  expect(delivered.queryByText("Confirmados")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Periodo, tienda o canal distintos");
});

it("mantiene los errores de acceso explícitos sin mostrar datos del negocio", () => {
  const { summary } = fixture();
  useMetrics.mockReturnValue({
    data: undefined,
    isError: true,
    error: new AdvertisingApiError("No tienes permiso para continuar.", 403),
    refetch: jest.fn(),
  });
  show(summary);

  expect(screen.getByText("No tienes permiso para continuar.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  expect(screen.queryByText("Entregados")).not.toBeInTheDocument();
});
