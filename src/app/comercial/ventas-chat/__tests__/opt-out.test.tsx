import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClientOrderPanel from "@/components/ventas-chat/ClientOrderPanel";
import * as svc from "@/services/crmService";
import type { Conversation } from "@/types/crm";

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
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listPipelines: jest.fn(),
  listTasks: jest.fn(),
  listConversationOrders: jest.fn(),
  updateConversation: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

const conv: Conversation = {
  id: "c1",
  channel: "whatsapp",
  contactPhone: "51999111222",
  contactName: "Ana Pérez",
  status: "open",
  assignedUserId: null,
  assignedUserName: null,
  clientId: null,
  unreadCount: 0,
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageDirection: null,
  lastInboundAt: null,
  windowExpiresAt: null,
  createdAt: "2026-11-19T10:00:00.000Z",
  pipelineId: null,
  stageId: null,
  stageChangedAt: null,
  lostReason: null,
  marketingOptOut: false,
  pauEnabled: false,
  pauHelpReason: null,
  scriptStep: null,
};

function setup(c: Conversation) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = { data: null, isLoading: false, isError: false, refetch: jest.fn() } as never;
  return render(
    <QueryClientProvider client={qc}>
      <ClientOrderPanel conversation={c} companyId={undefined} client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  s.listPipelines.mockResolvedValue([]);
  s.listTasks.mockResolvedValue([]);
  s.listConversationOrders.mockResolvedValue([]);
  s.updateConversation.mockResolvedValue({ ...conv, marketingOptOut: true });
});

describe("Panel · No enviar promociones", () => {
  it("el interruptor refleja marketingOptOut", () => {
    setup({ ...conv, marketingOptOut: true });
    expect(screen.getByRole("switch", { name: "No enviar promociones" })).toBeChecked();
  });

  it("al activarlo manda PATCH con marketingOptOut", async () => {
    setup(conv);
    const sw = screen.getByRole("switch", { name: "No enviar promociones" });
    expect(sw).not.toBeChecked();
    fireEvent.click(sw);
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { marketingOptOut: true }),
    );
  });
});
