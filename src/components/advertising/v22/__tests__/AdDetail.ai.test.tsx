import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import {
  adsWrite,
  type AdsRow,
  type AdsSales,
  type AdsSummary,
} from "@/services/advertisingV22Service";
import { AdvertisingAdDetail } from "../AdDetail";
import { emptySales } from "../model";

let mockCanGenerate: boolean | undefined = false;
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockRow = {
  id: "ad",
  accountId: "account",
  campaignId: "campaign",
  adsetId: "set",
  level: "ad",
  name: "Anuncio real",
  currency: "PEN",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  creative: { format: "image" },
  insights: { spend: "60", frequency: "1", impressions: "1000", actions: [] },
  store: { id: "store", name: "Tienda" },
} as unknown as AdsRow;

jest.mock("axios");
jest.mock("@/services/advertisingV22Service", () => ({
  ...jest.requireActual("@/services/advertisingV22Service"),
  adsWrite: jest.fn(),
}));
jest.mock("recharts", () =>
  Object.fromEntries(
    [
      "Bar",
      "BarChart",
      "CartesianGrid",
      "Line",
      "LineChart",
      "ResponsiveContainer",
      "Tooltip",
      "XAxis",
      "YAxis",
    ].map((name) => [name, () => null]),
  ),
);
jest.mock("../context", () => ({
  useAdsV22: () => ({
    identity: { token: "token", companyId: "company" },
    settings: {
      rules: { highFrequency: 3.5 },
      capabilities: { spend: true, profit: true, edit: true },
      tags: { hooks: [], creators: [] },
    },
  }),
  useRefreshAds: () => mockRefresh,
  useAdsQuery: (key: string[]) => ({
    data:
      key[0] === "products-v22"
        ? { products: [] }
        : key[0] === "ad-detail"
          ? {
              row: mockRow,
              daily: [],
              variations: [],
              changes: [],
              capabilities: { canManageAds: true, canGenerateAdText: mockCanGenerate },
            }
          : {},
    isError: false,
  }),
}));

function openVariation() {
  render(
    <AdvertisingAdDetail
      row={mockRow}
      summary={{ adProducts: [], days: [], quality: { warnings: [] } } as unknown as AdsSummary}
      sales={
        {
          totals: emptySales(),
          byAd: [],
          byChannel: [],
          byProduct: [],
          deliveryHistory: [],
        } as unknown as AdsSales
      }
      from="2026-10-01"
      to="2026-10-16"
      average={{ hook: null, hold: null, ctr: null, conversion: null }}
      onClose={jest.fn()}
      onAction={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Crear variación/ }));
}
function fillGenerator() {
  fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "Producto real" } });
  fireEvent.change(screen.getByLabelText("Precio neto S/"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Gancho"), { target: { value: "Gancho real" } });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockCanGenerate = false;
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "7d7b6cb1-15cc-44ce-88f3-487066fd5a70",
  });
});

it.each([false, undefined])(
  "does not request generated text without confirmed IA readiness (%s)",
  (canGenerate) => {
    mockCanGenerate = canGenerate;
    openVariation();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar texto" }));
    fillGenerator();
    expect(screen.getByRole("button", { name: "Generar 3 textos" })).toBeDisabled();
    expect(screen.getByText(/Solicita a administración/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar 3 textos" }));
    expect(adsWrite).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  },
);

it("creates a paused variation from the user's own text without IA or generator fields", async () => {
  (adsWrite as jest.Mock).mockResolvedValue({
    adId: "new",
    status: "succeeded",
    metaStatus: "PAUSED",
  });
  openVariation();
  fireEvent.click(screen.getByRole("button", { name: "Cambiar texto" }));
  fireEvent.change(screen.getByLabelText("Texto de la variación"), {
    target: { value: "Texto propio revisado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear variación pausada" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(adsWrite).toHaveBeenCalledTimes(1);
  expect(adsWrite).toHaveBeenCalledWith(
    expect.anything(),
    "post",
    "/meta/v22/ads/ad/variations",
    expect.objectContaining({ type: "text", body: "Texto propio revisado" }),
  );
});

it("requests three proposals only when IA readiness is confirmed", async () => {
  mockCanGenerate = true;
  (adsWrite as jest.Mock).mockResolvedValue({ texts: ["Uno", "Dos", "Tres"] });
  openVariation();
  fireEvent.click(screen.getByRole("button", { name: "Cambiar texto" }));
  fillGenerator();
  fireEvent.click(screen.getByRole("button", { name: "Generar 3 textos" }));
  await waitFor(() => expect(screen.getByLabelText("Texto de la variación")).toHaveValue("Uno"));
  expect(adsWrite).toHaveBeenCalledWith(
    expect.anything(),
    "post",
    "/meta/v22/ads/ad/text-variations",
    expect.objectContaining({ productName: "Producto real" }),
  );
});

it("keeps media variations available when IA is unavailable", async () => {
  (axios.post as jest.Mock).mockResolvedValue({ data: { id: "image" } });
  (adsWrite as jest.Mock).mockResolvedValue({
    adId: "new",
    status: "succeeded",
    metaStatus: "PAUSED",
  });
  openVariation();
  fireEvent.change(screen.getByLabelText("Imagen o video de la variación"), {
    target: { files: [new File(["image"], "image.png", { type: "image/png" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear variación pausada" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(adsWrite).toHaveBeenCalledWith(
    expect.anything(),
    "post",
    "/meta/v22/ads/ad/variations",
    expect.objectContaining({ type: "media", mediaId: "image" }),
  );
  expect(adsWrite).toHaveBeenCalledTimes(1);
});
