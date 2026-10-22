import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import {
  getCommercialLeadCapabilities,
  listCommercialLeadTypes,
} from "@/services/commercialLeadsService";
import { getCommercialLeadReport } from "@/services/commercialLeadReportsService";
import Page from "../page";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/DashboardScopeContext", () => ({
  useDashboardScope: jest.fn(),
}));
jest.mock("@/services/commercialLeadsService", () => ({
  getCommercialLeadCapabilities: jest.fn(),
  listCommercialLeadTypes: jest.fn(),
  commercialLeadError: (e: Error) => e.message,
}));
jest.mock("@/services/commercialLeadReportsService", () => ({
  getCommercialLeadReport: jest.fn(),
  leadReportCsv: jest.fn(),
}));
const totals = {
  received: 3,
  pipelineReceived: 2,
  open: 1,
  lost: 0,
  converted: 2,
  sellerConverted: 1,
  webPrepaidConverted: 1,
  legacyConverted: 0,
  pipelineConversionRate: 50,
  conversionRate: 66.67,
};
const fixture = {
  period: {
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    timeZone: "America/Lima",
  },
  scope: { storeIds: ["store-A"], includeUnassignedStore: true },
  totals,
  byType: [
    {
      ...totals,
      typeCode: "EVENTO_FUTURO",
      name: "Tipo futuro",
      active: false,
    },
  ],
  bySeller: [],
  byConfirmer: [],
  amountsByCurrency: [
    {
      currency: "PEN",
      estimatedAmount: "100.00",
      convertedEstimatedAmount: "50.00",
    },
    {
      currency: "USD",
      estimatedAmount: "20.00",
      convertedEstimatedAmount: "10.00",
    },
  ],
  daily: [],
  confirmedInPeriod: {
    count: 4,
    seller: 2,
    webPrepaid: 1,
    legacy: 1,
    withoutDate: 2,
  },
  coverage: {
    classifiedOrders: 3,
    legacyUnclassifiedOrders: 1,
    unknownCurrencyRecords: 0,
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuth)
    .mockReturnValue({
      auth: { company: { id: "company-A" }, user: { id: "user-A" } },
    } as any);
  jest
    .mocked(useDashboardScope)
    .mockReturnValue({
      scope: "business",
      storeIds: ["store-A"],
      canFetch: true,
    } as any);
  jest
    .mocked(getCommercialLeadCapabilities)
    .mockResolvedValue({ enabled: true, canView: true } as any);
  jest
    .mocked(listCommercialLeadTypes)
    .mockResolvedValue([
      { code: "EVENTO_FUTURO", name: "Tipo futuro", active: false },
    ] as any);
  jest.mocked(getCommercialLeadReport).mockResolvedValue(fixture as any);
});
it("respects disabled/forbidden capability without loading report data", async () => {
  jest
    .mocked(getCommercialLeadCapabilities)
    .mockResolvedValue({ enabled: false, canView: false } as any);
  render(<Page />);
  expect(
    await screen.findByText(/todavía no está habilitada/),
  ).toBeInTheDocument();
  expect(getCommercialLeadReport).not.toHaveBeenCalled();
  expect(listCommercialLeadTypes).not.toHaveBeenCalled();
});
it("renders future/inactive types, per-currency estimates, coverage and separate web/seller semantics", async () => {
  render(<Page />);
  expect(
    await screen.findByRole("heading", { name: "Todos los tipos de lead" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("rowheader", { name: /Tipo futuro/ }),
  ).toBeInTheDocument();
  expect(screen.getByText(/2 conversiones sin fecha/)).toBeInTheDocument();
  expect(screen.getByText("PEN")).toBeInTheDocument();
  expect(screen.getByText("USD")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Web prepago" }),
  ).toBeInTheDocument();
  expect(getCommercialLeadReport).toHaveBeenCalledWith(
    expect.objectContaining({
      storeIds: "store-A",
      includeUnassignedStore: true,
    }),
    expect.anything(),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Tipo de lead" }), {
    target: { value: "EVENTO_FUTURO" },
  });
  await waitFor(() =>
    expect(getCommercialLeadReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ typeCode: "EVENTO_FUTURO" }),
      expect.anything(),
    ),
  );
});
it("does not show a response from a prior tenant after switching company", async () => {
  let resolve!: (value: any) => void;
  jest.mocked(getCommercialLeadReport).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { rerender } = render(<Page />);
  await waitFor(() => expect(getCommercialLeadReport).toHaveBeenCalledTimes(1));
  jest
    .mocked(useAuth)
    .mockReturnValue({
      auth: { company: { id: "company-B" }, user: { id: "user-B" } },
    } as any);
  jest
    .mocked(useDashboardScope)
    .mockReturnValue({
      scope: "store",
      storeIds: ["store-B"],
      canFetch: true,
    } as any);
  jest
    .mocked(getCommercialLeadReport)
    .mockResolvedValue({
      ...fixture,
      byType: [],
      totals: { ...totals, received: 0 },
    } as any);
  rerender(<Page />);
  resolve(fixture);
  await waitFor(() =>
    expect(
      screen.getByText("No hay oportunidades recibidas en este periodo."),
    ).toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("rowheader", { name: /Tipo futuro/ }),
  ).not.toBeInTheDocument();
});
