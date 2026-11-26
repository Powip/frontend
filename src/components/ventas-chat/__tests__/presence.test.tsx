import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PresenceBanner, PresenceFlag, presenceNames, PRESENCE_BEAT_MS } from "../Presence";
import { beatPresence, getPresence } from "@/services/crmAjustesEService";
import type { Conversation } from "@/types/crm";

const mutate = jest.fn();
jest.mock("@/services/crmAjustesEService", () => ({
  beatPresence: jest.fn(async () => undefined),
  getPresence: jest.fn(async () => ({ enabled: true, viewers: { c1: [{ userId: "u2", userName: "Ana Pérez" }] } })),
}));
jest.mock("@/hooks/useCrmChat", () => ({ useUpdateConversation: () => ({ mutate, isPending: false }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { user: { id: "me" } } }) }));

const conv = (over: Partial<Conversation> = {}) =>
  ({ id: "c1", assignedUserId: "u3", assignedUserName: "Rosa Quispe", ...over }) as Conversation;

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("presencia en la Bandeja", () => {
  it("nombra a quien está viendo", () => {
    expect(presenceNames([{ userId: "a", userName: "Ana Pérez" }])).toBe("Ana");
    expect(presenceNames([{ userId: "a", userName: "agente.prueba@mailinator.com" }])).toBe("agente.prueba");
    expect(
      presenceNames([
        { userId: "a", userName: "Ana" },
        { userId: "b", userName: "Bea" },
        { userId: "c", userName: "Cris" },
      ]),
    ).toBe("Ana y 2 más");
    render(<PresenceFlag viewers={[{ userId: "a", userName: "Ana Pérez" }]} />);
    expect(screen.getByTestId("presence-flag")).toHaveTextContent("Ana también lo ve");
  });

  it("no muestra nada si nadie más lo ve", () => {
    const { container } = render(<PresenceFlag viewers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("el chat avisa cada 20 s y muestra quién más lo ve con Tomar el chat", async () => {
    jest.useFakeTimers();
    wrap(<PresenceBanner conversation={conv()} />);
    expect(beatPresence).toHaveBeenCalledWith("c1");
    expect(await screen.findByTestId("presence-banner")).toHaveTextContent(
      "Ana también está viendo este chat. Responde solo Rosa para no duplicar mensajes.",
    );
    act(() => {
      jest.advanceTimersByTime(PRESENCE_BEAT_MS);
    });
    expect(beatPresence).toHaveBeenCalledTimes(2);
    act(() => screen.getByRole("button", { name: "Tomar el chat" }).click());
    expect(mutate).toHaveBeenCalledWith({ assignedUserId: "me" });
    jest.useRealTimers();
  });

  it("si la empresa apagó la presencia no muestra aviso", async () => {
    (getPresence as jest.Mock).mockResolvedValueOnce({ enabled: false, viewers: {} });
    wrap(<PresenceBanner conversation={conv({ id: "c9" })} />);
    await act(async () => undefined);
    expect(screen.queryByTestId("presence-banner")).toBeNull();
  });
});
