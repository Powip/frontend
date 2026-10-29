import { render, screen, within } from "@testing-library/react";
import { useAdvertisingAssignmentsV11, useAdvertisingSummaryV11 } from "@/hooks/useAdvertisingV11";
import { AdvertisingAssignedSpendV11 } from "../AdvertisingAssignedSpendV11";
import { assignmentsV11, summaryV11 } from "./advertising-v11-fixtures";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "fixture-token" },
  }),
}));
jest.mock("@/hooks/useAdvertisingV11", () => ({
  useAdvertisingAssignmentsV11: jest.fn(),
  useAdvertisingSummaryV11: jest.fn(),
}));
// This suite verifies channel-spend coverage; business-order cost has its own suite.
jest.mock("../AdvertisingSalesCostCard", () => ({ AdvertisingSalesCostCard: () => null }));
it.each([
  { coverage: "partial" as const, provisional: false, label: "Parcial / pendiente" },
  { coverage: "complete" as const, provisional: true, label: "Provisional" },
])(
  "never labels a partial channel group complete when currency total is complete",
  ({ coverage, provisional, label }) => {
    const summary = summaryV11();
    summary.channelDaily = [
      {
        date: summary.from,
        accountId: "account",
        storeId: "store-a",
        channelId: null,
        currency: "PEN",
        spend: "100.10",
        coverage,
        provisional,
      },
    ];
    jest
      .mocked(useAdvertisingSummaryV11)
      .mockReturnValue({ data: summary } as ReturnType<typeof useAdvertisingSummaryV11>);
    jest
      .mocked(useAdvertisingAssignmentsV11)
      .mockReturnValue({ data: assignmentsV11() } as ReturnType<
        typeof useAdvertisingAssignmentsV11
      >);
    render(<AdvertisingAssignedSpendV11 from={summary.from} to={summary.to} />);
    const table = screen.getByRole("table", { name: "Consumo de publicidad por tienda y canal" });
    expect(within(table).getByText(label)).toBeInTheDocument();
    expect(within(table).queryByText("Completo")).not.toBeInTheDocument();
  },
);
