import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MetaAudienceCard, MetaCapiCard } from "@/components/ventas-chat/AjustesMetaAdsCards";
import AdResultsCard, { limaDay } from "@/components/ventas-chat/AjustesAdResultsCard";
import ChatAdSignalSection from "@/components/ventas-chat/ChatAdSignalSection";
import * as svc from "@/services/crmMetaAdsService";
import type { Conversation } from "@/types/crm";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: "admin",
    isAdmin: true,
    isSupervisor: true,
    stores: [
      { id: "s1", name: "Tienda Uno" },
      { id: "s2", name: "Tienda Dos" },
    ],
    fromServer: true,
    phoneMasked: false,
  }),
}));
jest.mock("@/services/crmMetaAdsService", () => ({
  ...jest.requireActual("@/services/crmMetaAdsService"),
  getMetaAdsSettings: jest.fn(),
  updateMetaAdsSettings: jest.fn(),
  listMetaAdAccounts: jest.fn(),
  listAudienceSegments: jest.fn(),
  exportAudience: jest.fn(),
  listAudienceExports: jest.fn(),
  listCapiEvents: jest.fn(),
  getConversationAdSignal: jest.fn(),
  getAdResults: jest.fn(),
}));
const m = svc as jest.Mocked<typeof svc>;

const settings = (over: Partial<svc.MetaAdsSettings> = {}): svc.MetaAdsSettings => ({
  pixelId: null,
  effectivePixelId: "PIX-ENV",
  capiEnabled: true,
  defaultAdAccountId: null,
  adsTokenConfigured: true,
  capiTokenConfigured: true,
  simulated: true,
  ...over,
});

const renderWith = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  m.getMetaAdsSettings.mockResolvedValue(settings());
  m.listMetaAdAccounts.mockResolvedValue({
    items: [
      { id: "act_1", name: "Cuenta Uno", currency: "PEN" },
      { id: "act_2", name: "Cuenta Dos", currency: "PEN" },
    ],
    simulated: true,
  });
  m.listCapiEvents.mockResolvedValue([]);
  m.listAudienceExports.mockResolvedValue([]);
  m.listAudienceSegments.mockResolvedValue([
    { key: "bought_90d", label: "Compraron en 90 días", hint: "Clientes con pedido", count: 4, lastSentAt: null },
    { key: "thinking", label: "Lo están pensando", hint: "Sin respuesta", count: 0, lastSentAt: null },
  ]);
});

describe("MetaCapiCard", () => {
  it("guarda pixel y switch, y rechaza pixel con letras", async () => {
    m.updateMetaAdsSettings.mockResolvedValue(settings({ pixelId: "999" }));
    m.listCapiEvents.mockResolvedValue([
      { id: "e1", conversationId: "c1", orderNumber: "P-10", value: 150, currency: "PEN", status: "sent", attempts: 1, lastError: null, sentAt: "2026-11-20T15:00:00Z", createdAt: "2026-11-20T15:00:00Z" },
    ]);
    renderWith(<MetaCapiCard />);
    const pixel = await screen.findByLabelText(/Pixel o dataset/);
    const log = await screen.findByTestId("capi-log");
    expect(within(log).getByText("P-10")).toBeInTheDocument();
    expect(within(log).getByText("Enviado")).toBeInTheDocument();
    fireEvent.change(pixel, { target: { value: "12ab" } });
    expect(screen.getByText("El pixel es solo números.")).toBeInTheDocument();
    fireEvent.change(pixel, { target: { value: "999" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() =>
      expect(m.updateMetaAdsSettings).toHaveBeenCalledWith({ pixelId: "999", capiEnabled: false }),
    );
  });

  it("dice qué clave falta en el servidor", async () => {
    m.getMetaAdsSettings.mockResolvedValue(settings({ capiTokenConfigured: false, effectivePixelId: null, simulated: false }));
    renderWith(<MetaCapiCard />);
    expect(await screen.findByText(/META_CAPI_ACCESS_TOKEN/)).toBeInTheDocument();
    expect(screen.getByText(/META_CAPI_PIXEL_ID/)).toBeInTheDocument();
  });
});

describe("MetaAudienceCard", () => {
  it("envía un público con la cuenta y la tienda elegidas", async () => {
    m.exportAudience.mockResolvedValue({ id: "x1", metaAudienceId: "A1", contactCount: 4, received: 4, simulated: true });
    renderWith(<MetaAudienceCard />);
    const btn = await screen.findByRole("button", { name: "Enviar a Meta: Compraron en 90 días" });
    expect(screen.getByRole("button", { name: "Enviar a Meta: Lo están pensando" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cuenta publicitaria"), { target: { value: "act_2" } });
    fireEvent.click(btn);
    await waitFor(() => expect(m.exportAudience).toHaveBeenCalled());
    const input = m.exportAudience.mock.calls[0][0];
    expect(input).toMatchObject({ segment: "bought_90d", adAccountId: "act_2" });
    expect(input.name).toMatch(/^POWIP · Compraron en 90 días · /);
  });

  it("usa la cuenta por defecto de los ajustes", async () => {
    m.getMetaAdsSettings.mockResolvedValue(settings({ defaultAdAccountId: "act_2" }));
    renderWith(<MetaAudienceCard />);
    await waitFor(() =>
      expect((screen.getByLabelText("Cuenta publicitaria") as HTMLSelectElement).value).toBe("act_2"),
    );
  });
});

describe("AdResultsCard", () => {
  const results = (over: Partial<svc.AdResults> = {}): svc.AdResults => ({
    from: "2026-10-25",
    to: "2026-11-23",
    adAccountId: "act_1",
    currency: "PEN",
    attributionDays: 28,
    simulated: true,
    spendError: null,
    totals: { spend: 150, chats: 12, orders: 3, revenue: 450, costPerChat: 12.5, costPerOrder: 50, roas: 3 },
    items: [
      { adId: "AD1", adName: "Polos 2x1", campaignName: "Polos", spend: 100, impressions: 5000, clicks: 80, chats: 10, orders: 3, revenue: 450, costPerChat: 10, costPerOrder: 33.33, roas: 4.5 },
      { adId: null, adName: "Anuncio sin identificar", campaignName: null, spend: null, impressions: null, clicks: null, chats: 2, orders: 0, revenue: 0, costPerChat: null, costPerOrder: null, roas: null },
    ],
    ...over,
  });

  it("muestra totales y tabla por anuncio de los últimos 30 días", async () => {
    m.getAdResults.mockResolvedValue(results());
    renderWith(<AdResultsCard />);
    const table = await screen.findByTestId("ad-results-table");
    expect(within(table).getByText("Polos 2x1")).toBeInTheDocument();
    expect(within(table).getByText("4.50x")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-chats")).toHaveTextContent("12");
    expect(screen.getByTestId("kpi-roas")).toHaveTextContent("3.00x");
    expect(m.getAdResults).toHaveBeenLastCalledWith({ from: limaDay(29), to: limaDay(0), adAccountId: "act_1" });
  });

  it("explica la clave que falta y no rompe", async () => {
    m.getAdResults.mockResolvedValue(
      results({ spendError: "Falta META_ADS_ACCESS_TOKEN: el gasto de Meta no se puede leer.", totals: { ...results().totals, spend: null, roas: null } }),
    );
    renderWith(<AdResultsCard />);
    expect(await screen.findByTestId("ad-results-spend-error")).toHaveTextContent("META_ADS_ACCESS_TOKEN");
    expect(screen.getByTestId("kpi-spend")).toHaveTextContent("—");
  });

  it("avisa si el rango está al revés y no consulta", async () => {
    m.getAdResults.mockResolvedValue(results());
    renderWith(<AdResultsCard />);
    await screen.findByTestId("ad-results-table");
    m.getAdResults.mockClear();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-12-31" } });
    expect(screen.getByText(/debe ser anterior/)).toBeInTheDocument();
    expect(m.getAdResults).not.toHaveBeenCalled();
  });
});

describe("ChatAdSignalSection", () => {
  const conv = { id: "c1" } as Conversation;
  it("muestra el anuncio y el estado de cada compra", async () => {
    m.getConversationAdSignal.mockResolvedValue({
      fromAd: true,
      ad: { headline: "Polos 2x1", sourceId: "AD1", sourceType: "ad", at: "2026-11-20T10:00:00Z" },
      purchases: [{ orderNumber: "P-10", value: 150, currency: "PEN", status: "failed", sentAt: null, lastError: "token" }],
    });
    renderWith(<ChatAdSignalSection conversation={conv} />);
    const box = await screen.findByTestId("chat-ad-signal");
    expect(within(box).getByText("Polos 2x1")).toBeInTheDocument();
    expect(within(box).getByText("Falló")).toBeInTheDocument();
  });
  it("se oculta si el chat no vino de un anuncio", async () => {
    m.getConversationAdSignal.mockResolvedValue({ fromAd: false, ad: null, purchases: [] });
    renderWith(<ChatAdSignalSection conversation={conv} />);
    await waitFor(() => expect(m.getConversationAdSignal).toHaveBeenCalled());
    expect(screen.queryByTestId("chat-ad-signal")).toBeNull();
  });
});
