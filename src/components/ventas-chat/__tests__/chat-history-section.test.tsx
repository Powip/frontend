import { render, screen } from "@testing-library/react";
import { ChatHistorySection, historyEvents } from "../ChatHistorySection";
import type { Conversation, Message } from "@/types/crm";

const msg = (id: string, type: string, body: string | null, createdAt: string) =>
  ({ id, type, body, createdAt, direction: "out" }) as unknown as Message;

const ITEMS = [
  msg("a", "system", "Entró por anuncio", "2026-11-24T15:41:00.000Z"),
  msg("b", "text", "Hola", "2026-11-24T15:42:00.000Z"),
  msg("c", "system", "Pasó a Cotizado", "2026-11-24T15:47:00.000Z"),
  msg("d", "system", "  ", "2026-11-24T15:48:00.000Z"),
];

let items: Message[] | undefined = ITEMS;
jest.mock("@/hooks/useCrmChat", () => ({ useMessages: () => ({ data: items ? { items, hasMore: false } : undefined }) }));

describe("Historial del panel Seguimiento", () => {
  it("toma solo los mensajes de sistema con texto, el más nuevo arriba", () => {
    expect(historyEvents(ITEMS).map((m) => m.id)).toEqual(["c", "a"]);
    expect(historyEvents(ITEMS, 1).map((m) => m.id)).toEqual(["c"]);
    expect(historyEvents(undefined)).toEqual([]);
  });

  it("lista los hechos del chat", () => {
    items = ITEMS;
    render(<ChatHistorySection conversation={{ id: "c1" } as Conversation} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Pasó a Cotizado");
    expect(rows[1]).toHaveTextContent("Entró por anuncio");
  });

  it("sin movimientos lo dice", () => {
    items = undefined;
    render(<ChatHistorySection conversation={{ id: "c1" } as Conversation} />);
    expect(screen.getByText("Aún no hay movimientos en este chat.")).toBeInTheDocument();
  });
});
