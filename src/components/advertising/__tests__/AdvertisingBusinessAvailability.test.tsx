import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import { useAdvertisingSummaryV11 } from "@/hooks/useAdvertisingV11";
import { AdvertisingModuleSummary } from "../AdvertisingModuleSummary";
import type { AdvertisingSnapshot } from "../advertising-model";
import { summaryV11 } from "./advertising-v11-fixtures";

jest.mock("@/hooks/useAdvertisingBusinessMetrics", () => ({
  useAdvertisingBusinessMetrics: jest.fn(),
}));
jest.mock("@/hooks/useAdvertisingV11", () => ({ useAdvertisingSummaryV11: jest.fn() }));
jest.mock("../AdvertisingStackedSpendChart", () => ({ AdvertisingStackedSpendChart: () => null }));
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));

const businessQuery = jest.mocked(useAdvertisingBusinessMetrics);
const summaryQuery = jest.mocked(useAdvertisingSummaryV11);
const privateDetail = "cliente@example.test private-token ADMINISTRADOR";
const snapshot: AdvertisingSnapshot = {
  today: "2026-10-03",
  accounts: [
    {
      id: "account",
      provider: "meta",
      name: "Cuenta de prueba",
      externalId: "123",
      currency: "PEN",
      timeZone: "America/Lima",
      enabled: true,
      updatedAt: null,
    },
  ],
  days: [],
  manualRecords: [],
  providers: {
    meta: { available: true, status: "connected" },
    tiktok: { available: false, status: "disconnected" },
  },
};

it.each([
  [401, "Vuelve a iniciar sesión para continuar."],
  [403, "No tienes permiso para continuar."],
  [503, "Publicidad no está disponible. Inténtalo de nuevo."],
] as const)(
  "muestra el error %s de Powip y permite reintentar sin detalles privados",
  async (status, text) => {
    const refetch = jest.fn();
    businessQuery.mockReturnValue({
      data: undefined,
      error: { isAxiosError: true, response: { status, data: { message: privateDetail } } },
      isError: true,
      isAccessDenied: status === 401 || status === 403,
      refetch,
    } as unknown as ReturnType<typeof useAdvertisingBusinessMetrics>);
    summaryQuery.mockReturnValue({
      data: summaryV11(),
      isError: false,
      isAccessDenied: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useAdvertisingSummaryV11>);
    render(
      <AdvertisingModuleSummary
        companyName="Empresa de prueba"
        token="synthetic-token"
        actorId="synthetic-actor"
        companyId="synthetic-company"
        from="2026-10-01"
        to="2026-10-03"
        snapshot={snapshot}
      />,
    );
    expect(within(screen.getByRole("alert")).getByText(text)).toBeVisible();
    expect(
      screen.queryByText("Los resultados del negocio están pendientes."),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(privateDetail);
    expect(document.body.textContent).not.toContain("ADMINISTRADOR");
    await userEvent.setup().click(screen.getByRole("button", { name: "Volver a consultar" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  },
);
