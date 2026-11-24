import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClientOrderPanel from "@/components/ventas-chat/ClientOrderPanel";
import { channelsText, lastPurchaseText } from "@/components/ventas-chat/clientProfile";
import axiosAuth from "@/lib/axiosAuth";
import * as crm from "@/services/crmService";
import * as ads from "@/services/crmMetaAdsService";
import type { Conversation, FollowupRule } from "@/types/crm";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Laura", role: "ADMIN" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({ hasAdminAccess: () => true }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listPipelines: jest.fn(),
  listTasks: jest.fn(),
  listConversationOrders: jest.fn(),
  listConversationQuotes: jest.fn(),
  listConversationFollowups: jest.fn(),
  listFollowupRules: jest.fn(),
  getOtherChannels: jest.fn(),
}));
jest.mock("@/services/crmMetaAdsService", () => ({
  ...jest.requireActual("@/services/crmMetaAdsService"),
  getConversationAdSignal: jest.fn(),
}));
const c = crm as jest.Mocked<typeof crm>;
const signal = ads.getConversationAdSignal as jest.Mock;
const get = axiosAuth.get as jest.Mock;

const conv = (over: Partial<Conversation> = {}) =>
  ({
    id: "c1",
    channel: "whatsapp",
    contactPhone: "51999111222",
    customerPhone: null,
    contactName: "Ana",
    status: "open",
    pipelineId: "p1",
    stageId: "s1",
    tags: [],
    ...over,
  }) as Conversation;

function panel(tab: "Cliente" | "Seguimiento", over: Partial<Conversation> = {}, client: unknown = null) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClientOrderPanel
        conversation={conv(over)}
        companyId="co1"
        client={{ data: client, isLoading: false, isError: false, refetch: jest.fn() } as never}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: tab }));
}

function history(data: unknown) {
  get.mockImplementation((url: string) => {
    if (!url.includes("/clients/cl1/history")) return new Promise(() => {});
    return data ? Promise.resolve({ data }) : Promise.reject(new Error("404"));
  });
}
const ANA = { id: "cl1", fullName: "Ana Pérez", phoneNumber: "999111222", city: "Arequipa" };
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  history(null);
  c.listPipelines.mockResolvedValue([
    {
      id: "p1",
      isDefault: true,
      stages: [
        { id: "s1", name: "Nuevo", kind: "open" },
        { id: "s2", name: "Cotizado", kind: "open" },
        { id: "s9", name: "Perdido", kind: "lost" },
      ],
    },
  ] as never);
  c.listTasks.mockResolvedValue([]);
  c.listConversationOrders.mockResolvedValue([]);
  c.listConversationQuotes.mockResolvedValue([]);
  c.listConversationFollowups.mockResolvedValue([]);
  c.listFollowupRules.mockResolvedValue([]);
  c.getOtherChannels.mockResolvedValue([]);
  signal.mockResolvedValue({ fromAd: false, ad: null, purchases: [] });
});

describe("Pestaña Cliente", () => {
  it("muestra ciudad, anuncio de origen e historial con rechazos", async () => {
    signal.mockResolvedValue({ fromAd: true, ad: { headline: "Polos 2x1", sourceId: "a1" }, purchases: [] });
    history({ purchases: 4, rejections: 1, spent: 250, lastPurchaseAt: daysAgo(3) });
    panel("Cliente", {}, ANA);
    expect(screen.getByText("Arequipa")).toBeInTheDocument();
    expect((await screen.findAllByText("Polos 2x1")).length).toBeGreaterThan(0);
    const box = within(await screen.findByRole("region", { name: "Historial con la marca" }));
    expect(box.getByText("4")).toBeInTheDocument();
    expect(box.getByText("1")).toHaveClass("text-destructive");
    expect(box.getByText("S/ 250.00")).toBeInTheDocument();
    expect(box.getByText("Última compra hace 3 días.")).toBeInTheDocument();
  });

  it("si Core no da historial no inventa ceros", async () => {
    panel("Cliente", {}, ANA);
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("/clients/cl1/history")));
    expect(screen.queryByText("Historial con la marca")).not.toBeInTheDocument();
  });

  it("sin anuncio dice el canal, y los otros canales del mismo número", async () => {
    c.getOtherChannels.mockResolvedValue(["instagram"]);
    panel("Cliente");
    expect(await screen.findByText("También escribió por Instagram.")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Sin dato")).toBeInTheDocument();
  });

  it("sin teléfono explica cuándo se unen los chats y no consulta", async () => {
    panel("Cliente", { channel: "instagram", contactPhone: "ig-1" });
    expect(await screen.findByText(/Cuando comparta su número/)).toBeInTheDocument();
    expect(c.getOtherChannels).not.toHaveBeenCalled();
  });
});

describe("Pestaña Seguimiento", () => {
  const rule = (id: string, over: Partial<FollowupRule> = {}) =>
    ({ id, name: id, stageId: "s1", waitMinutes: 120, active: true, ...over }) as FollowupRule;
  const rules = async () => within(await screen.findByRole("region", { name: "Reglas que aplican" }));

  it("lista solo las reglas activas de la etapa y las que valen para toda etapa abierta", async () => {
    c.listFollowupRules.mockResolvedValue([
      rule("Etapa"),
      rule("General", { stageId: null }),
      rule("Otra etapa", { stageId: "s2" }),
      rule("Apagada", { active: false }),
    ]);
    panel("Seguimiento");
    const box = await rules();
    expect(box.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Etapa2 h", "General2 h"]);
    expect(box.getByRole("link", { name: "Ver reglas" })).toHaveAttribute(
      "href",
      "/comercial/ventas-chat/seguimientos",
    );
  });

  it("en una etapa cerrada las reglas generales no valen", async () => {
    c.listFollowupRules.mockResolvedValue([rule("General", { stageId: null })]);
    panel("Seguimiento", { stageId: "s9" });
    const box = await rules();
    expect(await box.findByText("Ninguna regla automática para la etapa Perdido.")).toBeInTheDocument();
  });

  it("«Lo está pensando» sale en chats abiertos sin fecha de retomar", async () => {
    panel("Seguimiento");
    fireEvent.click(screen.getByRole("button", { name: "Lo está pensando" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("con fecha de retomar ya no se ofrece", () => {
    panel("Seguimiento", { resumeAt: daysAgo(-1) });
    expect(screen.queryByRole("button", { name: "Lo está pensando" })).not.toBeInTheDocument();
  });
});

describe("textos", () => {
  const NOW = Date.parse("2026-11-24T15:00:00.000Z");
  it("última compra", () => {
    expect(lastPurchaseText(null)).toBe("Cliente nuevo. Aún no tiene pedidos.");
    expect(lastPurchaseText("2026-11-24T10:00:00.000Z", NOW)).toBe("Última compra hace menos de un día.");
    expect(lastPurchaseText("2026-11-23T10:00:00.000Z", NOW)).toBe("Última compra hace 1 día.");
  });
  it("un solo canal", () => {
    expect(channelsText("whatsapp", true, [])).toMatch(/^Solo escribió por WhatsApp\./);
  });
});
