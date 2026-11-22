import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import EmbudoBoard from "@/components/ventas-chat/EmbudoBoard";
import * as svc from "@/services/crmService";
import type { Board, Conversation, Pipeline, Stage } from "@/types/crm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/embudo",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: "admin",
    isAdmin: true,
    isSupervisor: true,
    stores: [{ id: "st1", name: "Tienda Centro" }],
    fromServer: true,
  }),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listPipelines: jest.fn(),
  getBoard: jest.fn(),
  updateConversation: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

const stage = (id: string, name: string, position: number, kind: Stage["kind"] = "open"): Stage => ({
  id,
  pipelineId: "p1",
  name,
  color: "#22c55e",
  position,
  kind,
});
const stages = [
  stage("s1", "Nuevo", 0),
  stage("s2", "Cotizado", 1),
  stage("s3", "Ganado", 2, "won"),
  stage("s4", "Perdido", 3, "lost"),
];
const pipeline: Pipeline = { id: "p1", name: "Ventas", isDefault: true, stages };

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: "c1",
  channel: "whatsapp",
  contactPhone: "51999111222",
  customerPhone: null,
  contactName: "Ana Pérez",
  status: "open",
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  clientId: null,
  unreadCount: 2,
  lastMessageAt: new Date().toISOString(),
  lastMessagePreview: "Hola, precio?",
  lastMessageDirection: "in",
  lastInboundAt: null,
  windowExpiresAt: null,
  createdAt: new Date().toISOString(),
  pipelineId: "p1",
  stageId: "s1",
  stageChangedAt: null,
  lostReason: null,
  marketingOptOut: false,
  pauEnabled: false,
  pauHelpReason: null,
  scriptStep: null,
  resumeAt: null,
  resumeNote: null,
  tags: [],
  ...over,
});
const board = (): Board => ({
  pipeline,
  columns: [
    { stage: stages[0], total: 1, conversations: [conv()] },
    { stage: stages[1], total: 0, conversations: [] },
    { stage: stages[2], total: 0, conversations: [] },
    { stage: stages[3], total: 0, conversations: [] },
  ],
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EmbudoBoard />
    </QueryClientProvider>,
  );
}
const column = (name: string) => screen.getByRole("region", { name: `Etapa ${name}` });

beforeEach(() => {
  jest.clearAllMocks();
  s.listPipelines.mockResolvedValue([pipeline]);
  s.getBoard.mockImplementation(async () => board());
  s.updateConversation.mockResolvedValue(conv({ stageId: "s2" }));
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("Embudo", () => {
  it("pinta columnas con contador y la tarjeta con sus datos", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Etapa Nuevo" })).toBeInTheDocument();
    for (const n of ["Nuevo", "Cotizado", "Ganado", "Perdido"]) {
      expect(column(n)).toBeInTheDocument();
    }
    const card = within(column("Nuevo"));
    expect(card.getByText("Ana Pérez")).toBeInTheDocument();
    expect(card.getByText("Hola, precio?")).toBeInTheDocument();
    expect(card.getByLabelText("2 sin leer")).toBeInTheDocument();
    expect(card.getByText(/Jairo/)).toBeInTheDocument();
    expect(card.getByLabelText("1 conversaciones")).toBeInTheDocument();
    expect(s.getBoard).toHaveBeenCalledWith("p1", "all", undefined);
  });

  it("el filtro Mías vuelve a pedir el tablero con assigned=me", async () => {
    setup();
    await screen.findByText("Ana Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Mías" }));
    await waitFor(() => expect(s.getBoard).toHaveBeenCalledWith("p1", "me", undefined));
  });

  it("clic en la tarjeta abre la conversación en la Bandeja", async () => {
    setup();
    fireEvent.click(await screen.findByLabelText("Abrir conversación de Ana Pérez"));
    expect(mockPush).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1");
  });

  it("«Mover a…» llama al PATCH con la etapa nueva", async () => {
    setup();
    const select = await screen.findByLabelText("Mover a… (Ana Pérez)");
    fireEvent.change(select, { target: { value: "s2" } });
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { stageId: "s2" }),
    );
  });

  it("una etapa perdida pide el motivo y lo envía en lostReason", async () => {
    setup();
    const select = await screen.findByLabelText("Mover a… (Ana Pérez)");
    fireEvent.change(select, { target: { value: "s4" } });
    expect(s.updateConversation).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "No respondió" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar motivo" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", {
        stageId: "s4",
        lostReason: "No respondió",
      }),
    );
  });

  it("«Otro» exige texto antes de guardar el motivo", async () => {
    setup();
    fireEvent.change(await screen.findByLabelText("Mover a… (Ana Pérez)"), {
      target: { value: "s4" },
    });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Otro" }));
    const save = within(dialog).getByRole("button", { name: "Guardar motivo" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Motivo"), { target: { value: "Se mudó" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", {
        stageId: "s4",
        lostReason: "Se mudó",
      }),
    );
  });

  it("si el PATCH falla, la tarjeta vuelve a su columna y sale un aviso", async () => {
    let reject!: (e: unknown) => void;
    s.updateConversation.mockImplementation(
      () => new Promise((_, rej) => (reject = rej)),
    );
    setup();
    fireEvent.change(await screen.findByLabelText("Mover a… (Ana Pérez)"), {
      target: { value: "s2" },
    });
    // Optimista: ya está en Cotizado antes de que responda el servicio
    await waitFor(() => expect(within(column("Cotizado")).getByText("Ana Pérez")).toBeInTheDocument());
    expect(within(column("Nuevo")).queryByText("Ana Pérez")).not.toBeInTheDocument();

    // Al fallar se restaura el tablero y se avisa
    await act(async () => {
      reject(new Error("Sin conexión"));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sin conexión"));
    await waitFor(() => expect(within(column("Nuevo")).getByText("Ana Pérez")).toBeInTheDocument());
    expect(within(column("Cotizado")).queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("muestra el error de conexión con Reintentar", async () => {
    s.listPipelines.mockRejectedValue(new Error("boom"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
