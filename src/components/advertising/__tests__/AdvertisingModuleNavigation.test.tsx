import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPeriodProvider } from "@/contexts/AdminPeriodContext";
import { AdvertisingModulePage } from "../AdvertisingModulePage";
import { AdvertisingStoreFilterProvider } from "../AdvertisingStoreFilterContext";
import { getRoutePermissions } from "@/config/permissions.config";

let mockQueryString = "";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockQueryString),
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => (props: Record<string, unknown>) => (
    <output aria-label="Panel de publicidad">{JSON.stringify(props)}</output>
  ),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "actor" },
      company: { id: "company", stores: [{ id: "store", name: "Tienda" }] },
    },
  }),
}));
const stores = [{ id: "store", name: "Tienda" }];
function LegacyReader({ view }: { view: "ads" | "results" }) {
  return (
    <AdvertisingStoreFilterProvider stores={stores}>
      <AdminPeriodProvider>
        <AdvertisingModulePage view={view} />
      </AdminPeriodProvider>
    </AdvertisingStoreFilterProvider>
  );
}
const panel = () => JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}");

// These readers remain reachable by historic URLs; the v2.2 shell has its own four-tab tests.
describe("preserved legacy advertising readers", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/publicidad");
    mockQueryString = "";
  });
  it("preserves linked ad and account while applying the URL period before mounting the reader", () => {
    mockQueryString = "from=2026-10-01&to=2026-10-02&accountId=account&adId=456";
    const view = render(<LegacyReader view="ads" />);
    expect(panel()).toEqual(
      expect.objectContaining({
        actorId: "actor",
        companyId: "company",
        from: "2026-10-01",
        to: "2026-10-02",
        initialAccountId: "account",
        initialAdId: "456",
        level: "ad",
      }),
    );
    mockQueryString = "from=2026-10-03&to=2026-10-04&accountId=account&adId=789";
    view.rerender(<LegacyReader view="ads" />);
    expect(panel()).toEqual(
      expect.objectContaining({ from: "2026-10-03", to: "2026-10-04", initialAdId: "789" }),
    );
  });
  it("keeps year boundaries intact for a historic link", () => {
    mockQueryString = "from=2025-12-31&to=2026-01-01&accountId=account&adId=456";
    render(<LegacyReader view="ads" />);
    expect(panel()).toEqual(expect.objectContaining({ from: "2025-12-31", to: "2026-01-01" }));
  });
  it("retains both result sources without adding old result tabs to the new navigation", async () => {
    mockQueryString = "from=2026-10-01&to=2026-10-02&accountId=account&resultType=webPurchases";
    render(<LegacyReader view="results" />);
    expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
    expect(panel()).toEqual(
      expect.objectContaining({ initialResultType: "webPurchases", presentation: "results" }),
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "Pedidos Powip" }));
    expect(panel()).toEqual(
      expect.objectContaining({ view: "results", from: "2026-10-01", to: "2026-10-02" }),
    );
  });
  it("lets the live v2.2 role matrix authorize the new module instead of a finance grant", () => {
    expect(getRoutePermissions("/publicidad/anuncios")).toEqual([]);
  });
});
