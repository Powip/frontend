import { render, screen } from "@testing-library/react";
import AdvertisingPage from "@/app/administracion/pauta/page";
import { AdminPeriodProvider } from "@/contexts/AdminPeriodContext";

let mockSearch = "from=2026-10-01&to=2026-10-01";
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mockSearch) }));
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "actor" },
      company: { id: "company", name: "Empresa", stores: [{ id: "store-1" }] },
      accessToken: "fixture-token",
    },
  }),
}));
jest.mock("../AdvertisingLivePanel", () => ({
  AdvertisingLivePanel: ({
    from,
    to,
    storeIds,
  }: {
    from: string;
    to: string;
    storeIds: string[];
  }) => (
    <div data-testid="investment-period">
      {from} / {to} / {storeIds.join(",")}
    </div>
  ),
}));

describe("store-to-company advertising navigation", () => {
  it("applies the linked day to the real period context before showing investment", async () => {
    mockSearch = "from=2026-10-01&to=2026-10-01";
    render(
      <AdminPeriodProvider>
        <AdvertisingPage />
      </AdminPeriodProvider>,
    );
    expect(await screen.findByTestId("investment-period")).toHaveTextContent(
      "2026-10-01 / 2026-10-01 / store-1",
    );
  });
  it("ignores invalid dates and preserves the current context period", async () => {
    mockSearch = "from=2026-02-30&to=2026-03-01";
    render(
      <AdminPeriodProvider>
        <AdvertisingPage />
      </AdminPeriodProvider>,
    );
    expect(await screen.findByTestId("investment-period")).not.toHaveTextContent("2026-02-30");
  });
});
