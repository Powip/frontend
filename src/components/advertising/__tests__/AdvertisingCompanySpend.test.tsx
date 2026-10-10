import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import { AdvertisingApiError } from "@/services/advertisingService";
import { AdvertisingCompanySpend } from "../AdvertisingCompanySpend";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useAdvertisingSnapshot", () => ({ useAdvertisingSnapshot: jest.fn() }));

it("hides the previous consumption after a failed refetch and offers a retry", async () => {
  const refetch = jest.fn().mockResolvedValue(undefined);
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "test-token",
      user: { id: "actor-id" },
      company: { id: "company-id" },
    },
    loading: false,
  } as ReturnType<typeof useAuth>);
  jest.mocked(useAdvertisingSnapshot).mockReturnValue({
    isLoading: false,
    isError: true,
    error: new AdvertisingApiError("No pudimos consultar la publicidad. Intenta de nuevo.", 503),
    data: {
      effective: {
        scope: "company",
        from: "2026-10-01",
        to: "2026-10-02",
        rows: [],
        totals: [
          {
            currency: "PEN",
            amount: "110.01",
            importedAmount: "110.01",
            fallbackAmount: "0",
            additionalAmount: "0",
            coverage: "complete",
            missingAccountDays: 0,
            provisional: false,
          },
        ],
        pendingManualCount: 0,
        representedManualCount: 0,
        excludedManualCount: 0,
        conflictedManualIds: [],
      },
    },
    refetch,
  } as unknown as ReturnType<typeof useAdvertisingSnapshot>);

  render(<AdvertisingCompanySpend from="2026-10-01" to="2026-10-02" />);
  expect(screen.queryByText(/110.01/)).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos consultar");
  await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
