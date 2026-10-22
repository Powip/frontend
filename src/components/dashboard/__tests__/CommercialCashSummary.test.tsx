import { act, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { getLeadPaymentCapabilities } from "@/services/leadPaymentsService";
import { getCommercialCashReport } from "@/services/commercialLeadReportsService";
import { CommercialCashSummary } from "../CommercialCashSummary";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/leadPaymentsService", () => ({
  getLeadPaymentCapabilities: jest.fn(),
}));
jest.mock("@/services/commercialLeadReportsService", () => ({
  getCommercialCashReport: jest.fn(),
}));
const caps = jest.mocked(getLeadPaymentCapabilities),
  cash = jest.mocked(getCommercialCashReport);
const report = {
  period: {
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    timeZone: "America/Lima",
    dateBasis: "PAYMENT_DATE",
  },
  scope: { storeIds: [], includeUnassignedStore: true },
  totalsByCurrency: [
    {
      currency: "USD",
      paidAmount: "20.00",
      pendingAmount: "5.00",
      lostAmount: "0.00",
      withoutOrderPaidAmount: "10.00",
    },
  ],
  dailyByCurrency: [],
  coverage: { paymentCount: 2, withoutOrderCount: 1, unknownCurrencyCount: 0 },
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "token",
      company: { id: "company" },
      user: { id: "user", permissions: ["VIEW_FINANCES"] },
    },
  } as any);
  caps.mockResolvedValue({ enabled: true, canReview: true } as any);
  cash.mockResolvedValue(report as any);
});
it("does not request financial data without permission or when flags are disabled", async () => {
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "token",
      company: { id: "company" },
      user: { id: "user", permissions: [] },
    },
  } as any);
  const { rerender } = render(
    <CommercialCashSummary params={{ includeUnassignedStore: true }} />,
  );
  expect(caps).not.toHaveBeenCalled();
  expect(cash).not.toHaveBeenCalled();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "token",
      company: { id: "company" },
      user: { id: "user", permissions: ["VIEW_FINANCES"] },
    },
  } as any);
  caps.mockResolvedValue({ enabled: false, canReview: false } as any);
  rerender(<CommercialCashSummary params={{ includeUnassignedStore: true }} />);
  await screen.findByText(/caja integral de Leads está deshabilitada/);
  expect(cash).not.toHaveBeenCalled();
});
it("queries explicit unassigned-only scope and keeps exact currency amounts", async () => {
  render(
    <CommercialCashSummary
      params={{ storeIds: "", includeUnassignedStore: true, currency: "USD" }}
    />,
  );
  await screen.findByRole("region", { name: "Caja integral" });
  expect(cash).toHaveBeenCalledWith(
    { storeIds: "", includeUnassignedStore: true, currency: "USD" },
    expect.any(AbortSignal),
  );
  expect(screen.getByText("USD 20.00")).toBeInTheDocument();
  expect(screen.getByText("USD 10.00")).toBeInTheDocument();
});
it("hides the old scope immediately and ignores a delayed response after a tenant switch", async () => {
  let resolve!: (value: any) => void;
  cash.mockImplementationOnce(
    () =>
      new Promise((res) => {
        resolve = res;
      }),
  );
  const { rerender } = render(
    <CommercialCashSummary params={{ storeId: "store-A" }} />,
  );
  await waitFor(() => expect(cash).toHaveBeenCalledTimes(1));
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "token-B",
      company: { id: "company-B" },
      user: { id: "user-B", permissions: ["VIEW_FINANCES"] },
    },
  } as any);
  cash.mockResolvedValue({ ...report, totalsByCurrency: [] } as any);
  rerender(<CommercialCashSummary params={{ storeId: "store-B" }} />);
  expect(screen.queryByText("USD 20.00")).not.toBeInTheDocument();
  await screen.findByText("No hay pagos en este alcance.");
  await act(async () => resolve(report));
  expect(screen.queryByText("USD 20.00")).not.toBeInTheDocument();
});
it("refreshes totals after a financial mutation and hides them immediately on permission revocation", async () => {
  const { rerender } = render(
    <CommercialCashSummary params={{ storeId: "store-A" }} />,
  );
  await screen.findByText("USD 20.00");
  cash.mockResolvedValue({
    ...report,
    totalsByCurrency: [{ ...report.totalsByCurrency[0], paidAmount: "30.00" }],
  } as any);
  act(() =>
    window.dispatchEvent(
      new CustomEvent("commercial-leads:changed", {
        detail: { companyId: "company" },
      }),
    ),
  );
  await screen.findByText("USD 30.00");
  expect(cash).toHaveBeenCalledTimes(2);
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "token",
      company: { id: "company" },
      user: { id: "user", permissions: [] },
    },
  } as any);
  rerender(<CommercialCashSummary params={{ storeId: "store-A" }} />);
  expect(
    screen.queryByRole("region", { name: "Caja integral" }),
  ).not.toBeInTheDocument();
});
