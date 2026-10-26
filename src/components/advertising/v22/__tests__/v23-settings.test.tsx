import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { V23AdsetAssignments, V23ShopifyCodSettings } from "../V23Settings";
import {
  saveAdsetAssignment,
  saveCodSetting,
  suggestAdsetChannel,
  type V23Settings,
} from "@/services/advertisingV23SettingsService";
const refresh = jest.fn(),
  identity = { companyId: "company", token: "token" };
const data: V23Settings = {
  today: "2026-10-25",
  capabilities: { view: true, spend: true, profit: true, edit: true, configure: true },
  stores: [{ id: "store", name: "KUNCA" }],
  channels: [],
  sellers: [{ id: "seller", name: "Ana" }],
  assignments: [],
  shopifyCod: [
    {
      storeId: "store",
      storeName: "KUNCA",
      enabled: false,
      app: "other",
      appName: "",
      version: 0,
      source: "canonical-shopify-cod",
      connection: "connected",
      leadsToday: 3,
      lastLeadAt: null,
    },
  ],
  adsets: [
    {
      accountId: "account",
      accountName: "Meta Kunca",
      adsetId: "123",
      name: "Conjunto nuevo",
      campaignId: "456",
      campaignName: "Campaña Kunca",
      destinations: [{ type: "WHATSAPP", identifier: "+51999999999" }],
      destinationType: "WHATSAPP",
      effectiveStatus: "ACTIVE",
      currentStoreId: "store",
    },
  ],
};
jest.mock("../context", () => ({
  useAdsV22: () => ({ identity }),
  useRefreshAds: () => refresh,
  useAdsQuery: () => ({ data, isPending: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("../../AdvertisingStoreFilterContext", () => ({
  useAdvertisingStoreFilter: () => ({ storeId: "all" }),
}));
jest.mock("../../AdvertisingAccountFilterContext", () => ({
  useAdvertisingAccountFilter: () => ({ accountId: "all" }),
}));
jest.mock("@/services/advertisingV23SettingsService", () => ({
  ...jest.requireActual("@/services/advertisingV23SettingsService"),
  saveAdsetAssignment: jest.fn(),
  saveCodSetting: jest.fn(),
}));
describe("Publicidad v2.3 configuration", () => {
  beforeEach(() => jest.clearAllMocks());
  it("saves an explicit date from today and keeps sales ownership separate", async () => {
    render(<V23AdsetAssignments />);
    fireEvent.change(screen.getByLabelText("Vendedora del conjunto"), {
      target: { value: "seller" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    await waitFor(() =>
      expect(saveAdsetAssignment).toHaveBeenCalledWith(
        identity,
        expect.objectContaining({
          effectiveFrom: "2026-10-25",
          apply: "from_date",
          sellerId: "seller",
          sellerMode: "fixed",
          expectedVersion: 0,
        }),
      ),
    );
    expect(screen.getByText(/Las ventas se atribuyen a quien confirma/)).toBeInTheDocument();
  });
  it("does not silently select a primary channel for a mixed destination", () => {
    expect(
      suggestAdsetChannel({
        destinationType: "MESSAGING_APPS",
        destinations: [
          { type: "WHATSAPP", identifier: "a" },
          { type: "INSTAGRAM", identifier: "b" },
        ],
      }),
    ).toBeNull();
  });
  it("persists the COD visibility preference and displays counts from the canonical source", async () => {
    render(<V23ShopifyCodSettings />);
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByLabelText("App del formulario"), {
      target: { value: "releasit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Shopify COD" }));
    await waitFor(() =>
      expect(saveCodSetting).toHaveBeenCalledWith(identity, {
        storeId: "store",
        enabled: true,
        app: "releasit",
        appName: "",
        expectedVersion: 0,
      }),
    );
  });
});
