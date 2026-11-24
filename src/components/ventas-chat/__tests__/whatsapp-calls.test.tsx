import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WhatsAppCallOverlay, { formatTimer, requestWhatsAppCall } from "@/components/ventas-chat/WhatsAppCallOverlay";
import WhatsAppCallsPanel from "@/components/ventas-chat/WhatsAppCallsPanel";
import WhatsAppCallButton from "@/components/ventas-chat/WhatsAppCallButton";
import { looksLikeSdp, SIMULATED_SDP, WhatsAppAudioCall } from "@/lib/webrtcCall";
import * as svc from "@/services/crmCallSessionsService";
import * as crm from "@/services/crmService";
import * as content from "@/services/crmContentService";
import type { CallSession } from "@/types/crmCallSessions";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/llamadas",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: "VENTAS" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmCallSessionsService", () => ({
  getLiveCalls: jest.fn(),
  getCallsConfig: jest.fn(),
  getCallSessionStats: jest.fn(),
  listCallSessions: jest.fn(),
  getCallPermission: jest.fn(),
  requestCallPermission: jest.fn(),
  startCall: jest.fn(),
  acceptCall: jest.fn(),
  rejectCall: jest.fn(),
  hangupCall: jest.fn(),
  saveCallSessionResult: jest.fn(),
  sendCallLiveAi: jest.fn(),
  getCallLiveAi: jest.fn(),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  sendMessage: jest.fn(),
  listPipelines: jest.fn(),
  getConversation: jest.fn(),
  updateConversation: jest.fn(),
}));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  getScript: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
const c = crm as jest.Mocked<typeof crm>;

const session = (over: Partial<CallSession> = {}): CallSession => ({
  id: "11111111-1111-1111-1111-111111111111",
  conversationId: "22222222-2222-2222-2222-222222222222",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  direction: "in",
  status: "ringing",
  agentUserId: null,
  agentUserName: null,
  simulated: true,
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
  endReason: null,
  hasResult: false,
  createdAt: new Date().toISOString(),
  sdpOffer: SIMULATED_SDP,
  ...over,
});

function renderOverlay() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WhatsAppCallOverlay />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  s.getCallsConfig.mockResolvedValue({ enabled: false, recording: true });
  c.sendMessage.mockResolvedValue({} as never);
  c.listPipelines.mockResolvedValue([
    { id: "p1", name: "Ventas", isDefault: true, stages: [{ id: "s1", kind: "open" }, { id: "s9", kind: "lost" }] },
  ] as never);
  c.getConversation.mockResolvedValue({ pipelineId: "p1", stageId: "s1" } as never);
  c.updateConversation.mockResolvedValue({} as never);
  (content.getScript as jest.Mock).mockResolvedValue({ steps: [] });
});

describe("helpers de llamadas", () => {
  it("formatTimer da mm:ss", () => {
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(65.7)).toBe("01:05");
    expect(formatTimer(-3)).toBe("00:00");
  });

  it("looksLikeSdp solo acepta SDP real con audio", () => {
    expect(looksLikeSdp("v=0\r\no=- 1 1 IN IP4 1.2.3.4\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n")).toBe(true);
    expect(looksLikeSdp(SIMULATED_SDP)).toBe(false);
    expect(looksLikeSdp("hola")).toBe(false);
  });

  it("sin WebRTC usa el SDP simulado", async () => {
    const call = new WhatsAppAudioCall();
    const sdp = await call.offer(true);
    expect(sdp).toBe(SIMULATED_SDP);
    expect(call.fake).toBe(true);
    call.close();
  });

  it("en modo prueba no pide micrófono aunque la oferta traiga audio", async () => {
    const call = new WhatsAppAudioCall();
    const sdp = await call.answer("v=0\r\no=- 1 1 IN IP4 1.2.3.4\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n", true);
    expect(sdp).toBe(SIMULATED_SDP);
    expect(call.fake).toBe(true);
    call.close();
  });
});

describe("WhatsAppCallOverlay", () => {
  it("entrante: contestar, colgar y guardar resultado", async () => {
    const ringing = session();
    const active = session({ status: "active", agentUserId: "u1", answeredAt: new Date().toISOString() });
    const ended = { ...active, status: "ended" as const, durationSeconds: 42, endedAt: new Date().toISOString() };
    s.getLiveCalls.mockResolvedValue({ live: [ringing], pendingResult: [] });
    s.acceptCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [active], pendingResult: [] });
      return active;
    });
    s.hangupCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [ended] });
      return ended;
    });
    s.saveCallSessionResult.mockResolvedValue({} as never);

    renderOverlay();
    expect(await screen.findByRole("dialog", { name: "Llamada entrante de WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText(/Modo prueba/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Contestar/ }));
    expect(await screen.findByText("En llamada")).toBeInTheDocument();
    expect(s.acceptCall).toHaveBeenCalledWith(ringing.id, expect.stringContaining("v=0"));
    expect(screen.getByText(/Grabando · se avisó al cliente/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Colgar/ }));
    expect(await screen.findByRole("dialog", { name: "Resultado de la llamada" })).toBeInTheDocument();
    expect(screen.getByText(/00:42/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Volver a llamar"));
    expect(screen.getByLabelText(/¿Cuándo\?/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Resumen (opcional)"), { target: { value: "Quiere talla M" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() => expect(s.saveCallSessionResult).toHaveBeenCalled());
    const [id, input] = s.saveCallSessionResult.mock.calls[0];
    expect(id).toBe(ringing.id);
    expect(input).toMatchObject({ result: "callback", notes: "Quiere talla M" });
    expect(typeof input.callbackAt).toBe("string");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rechazar una entrante la oculta", async () => {
    const ringing = session();
    s.getLiveCalls.mockResolvedValue({ live: [ringing], pendingResult: [] });
    s.rejectCall.mockResolvedValue({ ...ringing, status: "rejected" });
    renderOverlay();
    fireEvent.click(await screen.findByRole("button", { name: /Rechazar/ }));
    await waitFor(() => expect(s.rejectCall).toHaveBeenCalledWith(ringing.id));
    expect(screen.queryByRole("dialog", { name: "Llamada entrante de WhatsApp" })).not.toBeInTheDocument();
  });

  it("saliente sin permiso: muestra el pedido de permiso y lo envía", async () => {
    s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [] });
    s.getCallPermission.mockResolvedValue({
      status: "none",
      expiresAt: null,
      canCall: false,
      canRequest: true,
      simulated: true,
    } as never);
    s.requestCallPermission.mockResolvedValue({
      status: "pending",
      expiresAt: null,
      canCall: false,
      canRequest: false,
      simulated: true,
      sent: true,
    } as never);
    renderOverlay();
    act(() => requestWhatsAppCall({ kind: "call", conversationId: "c1", contactName: "Ana Pérez" }));
    expect(await screen.findByText("Pedir permiso para llamar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido de permiso/ }));
    await waitFor(() => expect(s.requestCallPermission).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
  });

  it("saliente con permiso: llama y cuelga", async () => {
    const out = session({ direction: "out", agentUserId: "u1", sdpOffer: null });
    s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [] });
    s.getCallPermission.mockResolvedValue({
      status: "granted",
      expiresAt: null,
      canCall: true,
      canRequest: false,
      simulated: true,
    } as never);
    s.startCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [out], pendingResult: [] });
      return out;
    });
    s.hangupCall.mockResolvedValue({ ...out, status: "ended", durationSeconds: 0 });
    renderOverlay();
    act(() => requestWhatsAppCall({ kind: "call", conversationId: "c1", contactName: "Ana Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Llamar$/ }));
    await waitFor(() => expect(s.startCall).toHaveBeenCalledWith("c1", expect.stringContaining("v=0")));
    expect(await screen.findByText("Llamando por WhatsApp…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Colgar/ }));
    expect(await screen.findByRole("dialog", { name: "Resultado de la llamada" })).toBeInTheDocument();
    // Sin contestar, propone «No contestó».
    expect(screen.getByLabelText("No contestó")).toBeChecked();
  });
});

describe("Modo llamadas y cierre", () => {
  const CHAT = "22222222-2222-2222-2222-222222222222";

  /** Llama, contesta el cliente o no, y cuelga: deja abierta la tarjeta de resultado. */
  async function hangUp(answered: boolean, onSaved = jest.fn()) {
    const out = session({
      direction: "out",
      agentUserId: "u1",
      sdpOffer: null,
      ...(answered ? { status: "active", answeredAt: new Date().toISOString() } : {}),
    });
    s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [] });
    s.startCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [out], pendingResult: [] });
      return out;
    });
    s.hangupCall.mockResolvedValue({ ...out, status: "ended", durationSeconds: answered ? 30 : 0 });
    s.saveCallSessionResult.mockResolvedValue({} as never);
    renderOverlay();
    act(() =>
      requestWhatsAppCall({
        kind: "call",
        conversationId: CHAT,
        contactName: "Ana Pérez",
        start: { simulated: true },
        queueMode: true,
        onSaved,
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Colgar/ }));
    await screen.findByRole("dialog", { name: "Resultado de la llamada" });
    return onSaved;
  }

  it("vendió: manda el cierre al chat y pasa al siguiente de la cola", async () => {
    const onSaved = await hangUp(true);
    const text = screen.getByLabelText("Texto del cierre");
    expect(text).toHaveValue("¡Gracias, Ana! 🙌 Como conversamos, seguimos con tu pedido por aquí.");
    fireEvent.change(text, { target: { value: "Gracias, Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar y llamar al siguiente" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(true));
    expect(c.sendMessage).toHaveBeenCalledWith(CHAT, "Gracias, Ana");
    expect(c.updateConversation).not.toHaveBeenCalled();
  });

  it("no contestó: sin mensaje por defecto, y se puede salir del modo llamadas", async () => {
    const onSaved = await hangUp(false);
    expect(screen.getByLabelText("No contestó")).toBeChecked();
    expect(screen.queryByLabelText("Texto del cierre")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir del modo llamadas" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(false));
    expect(c.sendMessage).not.toHaveBeenCalled();
  });

  it("no le interesa: guarda el motivo y mueve el chat a perdido", async () => {
    await hangUp(true);
    fireEvent.click(screen.getByLabelText("No le interesa"));
    const reason = screen.getByLabelText("Motivo") as HTMLSelectElement;
    const chosen = reason.options[1].value;
    fireEvent.change(reason, { target: { value: chosen } });
    fireEvent.click(screen.getByLabelText("Enviar mensaje de cierre por WhatsApp"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir del modo llamadas" }));
    await waitFor(() => expect(c.updateConversation).toHaveBeenCalledWith(CHAT, { stageId: "s9", lostReason: chosen }));
    expect(s.saveCallSessionResult.mock.calls[0][1]).toMatchObject({
      result: "not_interested",
      notes: `Motivo: ${chosen}`,
    });
    expect(c.sendMessage).not.toHaveBeenCalled();
  });

  it("al colgar muestra los pasos del guion", async () => {
    (content.getScript as jest.Mock).mockResolvedValue({ steps: [{ name: "Saludo" }, { name: "Cierre" }] });
    await hangUp(true);
    expect(await screen.findByText("Lo que se cumplió del guion")).toBeInTheDocument();
    expect(screen.getByLabelText("1. Saludo")).toBeInTheDocument();
  });
});

describe("IA en vivo y horario para llamar", () => {
  const liveSetup = () => {
    const ringing = session();
    const active = session({ status: "active", agentUserId: "u1", answeredAt: new Date().toISOString() });
    const ended = { ...active, status: "ended" as const, durationSeconds: 30, endedAt: new Date().toISOString() };
    s.getLiveCalls.mockResolvedValue({ live: [ringing], pendingResult: [] });
    s.acceptCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [active], pendingResult: [] });
      return active;
    });
    s.hangupCall.mockImplementation(async () => {
      s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [ended] });
      return ended;
    });
  };

  it("encendida: muestra transcripción, objeción, sugerencia y propone el resumen al colgar", async () => {
    liveSetup();
    s.getCallsConfig.mockResolvedValue({ enabled: false, recording: false, liveAi: true });
    s.sendCallLiveAi.mockResolvedValue({
      callId: "x",
      mode: "mock",
      lines: [
        { who: "agent", text: "Hola Ana, te llamo por tu consulta", at: "" },
        { who: "customer", text: "Está caro", at: "", objection: "Precio", objectionResponse: "Va con envío gratis." },
      ],
      checks: [1],
      steps: ["Saludo"],
      tip: "Objeción «Precio»: Va con envío gratis.",
      objection: "Precio",
      summary: "Llamada de 2 intervenciones. Objeción: Precio.",
      done: false,
    });
    renderOverlay();
    fireEvent.click(await screen.findByRole("button", { name: /Contestar/ }));
    expect(await screen.findByText("Objeción «Precio»: Va con envío gratis.")).toBeInTheDocument();
    expect(screen.getByText("Modo prueba · sin llave")).toBeInTheDocument();
    expect(screen.getByText(/Está caro/)).toBeInTheDocument();
    expect(screen.getByText("Objeción · Precio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Colgar/ }));
    const notes = await screen.findByLabelText("Resumen de la IA (puedes editarlo)");
    expect(notes).toHaveValue("Llamada de 2 intervenciones. Objeción: Precio.");
  });

  it("al anotar más tarde trae el resumen guardado de la IA", async () => {
    const ended = session({ status: "ended", agentUserId: "u1", durationSeconds: 34 });
    s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [ended] });
    s.getCallLiveAi.mockResolvedValue({
      callId: ended.id,
      mode: "mock",
      lines: [{ who: "customer", text: "Listo, mándamelo", at: "" }],
      checks: [1, 2],
      steps: ["Saludo", "Precio"],
      tip: "",
      objection: null,
      summary: "Resumen guardado por la IA.",
      done: true,
    });
    renderOverlay();
    act(() => {
      requestWhatsAppCall({ kind: "result", session: ended } as never);
    });
    expect(await screen.findByLabelText("Resumen de la IA (puedes editarlo)")).toHaveValue(
      "Resumen guardado por la IA.",
    );
    expect(s.getCallLiveAi).toHaveBeenCalledWith(ended.id);
  });

  it("apagada: no escucha y lo dice", async () => {
    liveSetup();
    s.getCallsConfig.mockResolvedValue({ enabled: false, recording: false, liveAi: false });
    renderOverlay();
    fireEvent.click(await screen.findByRole("button", { name: /Contestar/ }));
    expect(await screen.findByText("La IA en vivo está apagada en Canales y tiendas.")).toBeInTheDocument();
    expect(screen.getByText("(apagada)")).toBeInTheDocument();
    expect(s.sendCallLiveAi).not.toHaveBeenCalled();
  });

  it("fuera del horario para llamar, el botón Llamar se desactiva", async () => {
    s.getCallsConfig.mockResolvedValue({
      enabled: true,
      recording: false,
      hours: { start: "09:00", end: "20:00", open: false },
    });
    s.getCallPermission.mockResolvedValue({
      status: "granted",
      expiresAt: null,
      canCall: true,
      canRequest: false,
      simulated: true,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <WhatsAppCallButton conversationId="conv-1" contactName="Ana" />
      </QueryClientProvider>,
    );
    const button = await screen.findByTitle("Fuera del horario para llamar (09:00 a 20:00)");
    expect(button).toBeDisabled();
  });
});

describe("Panel de llamadas", () => {
  it.each([
    [12, "12 min"],
    [undefined, "—"],
  ])("minutos que cobra Meta: %s", async (metaMinutes, shown) => {
    s.getLiveCalls.mockResolvedValue({ live: [], pendingResult: [] } as never);
    s.getCallsConfig.mockResolvedValue({ enabled: true } as never);
    s.getCallSessionStats.mockResolvedValue({ total: 5, answered: 4, totalMinutes: 30, avgSeconds: 60, metaMinutes, byUser: [] } as never);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WhatsAppCallsPanel />
      </QueryClientProvider>,
    );
    await screen.findByText("30 min");
    expect(screen.getByText("Minutos que cobra Meta").parentElement).toHaveTextContent(shown);
  });
});
