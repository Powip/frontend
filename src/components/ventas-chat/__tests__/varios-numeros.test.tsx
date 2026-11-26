import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { Conversation, ConversationListParams } from "@/types/crm";
import ConversationList from "../ConversationList";

/** Varios números por tienda (Corporación Aranni: Kunka con un número por vendedora). */
const mockMe = { level: "agent" as "agent" | "supervisor" | "admin" };
const calls: ConversationListParams[] = [];
let mockItems: Conversation[] = [];
const mockFilters = {
  numbers: [
    {
      channelAccountId: "acc-ana",
      businessPhone: "51900000001",
      storeId: "kunka",
      conversations: 2,
    },
    {
      channelAccountId: "acc-bea",
      businessPhone: "51900000002",
      storeId: "kunka",
      conversations: 1,
    },
  ],
  sellers: [
    { userId: "u-ana", name: "ana@aranni.pe" },
    { userId: "u-bea", name: "Bea" },
  ],
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: mockMe.level,
    isAdmin: mockMe.level === "admin",
    isSupervisor: mockMe.level !== "agent",
    stores: [{ id: "kunka", name: "Kunka" }],
    phoneMasked: false,
  }),
}));
jest.mock("@/hooks/useCrmChat", () => ({
  useConversations: (params: ConversationListParams) => {
    calls.push(params);
    return {
      data: { items: mockItems, total: mockItems.length, page: 1, limit: 30 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    };
  },
  useInboxSummary: () => ({ data: undefined }),
  useInboxFilters: () => ({ data: mockFilters }),
}));
jest.mock("@/hooks/useCrmPauLearning", () => ({ usePauLearning: () => ({ data: undefined }) }));
jest.mock("../ConversationPills", () => ({ __esModule: true, default: () => null }));
jest.mock("../CodNote", () => ({ __esModule: true, default: () => null }));
jest.mock("../Presence", () => ({ PresenceFlag: () => null, usePresenceViewers: () => ({}) }));

const conv = (over: Partial<Conversation>): Conversation =>
  ({
    id: "c1",
    channel: "whatsapp",
    contactPhone: "51955555555",
    customerPhone: null,
    contactName: "Rosa",
    status: "open",
    assignedUserId: null,
    assignedUserName: null,
    clientId: null,
    unreadCount: 0,
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: "hola",
    lastMessageDirection: "in",
    tags: [],
    ...over,
  }) as Conversation;

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
  mockItems = [
    conv({
      id: "c-ana",
      contactName: "Rosa",
      channelAccountId: "acc-ana",
      businessPhone: "51900000001",
    }),
    conv({
      id: "c-bea",
      contactName: "Luz",
      channelAccountId: "acc-bea",
      businessPhone: "51900000002",
    }),
  ];
});

describe("Bandeja con varios números por tienda", () => {
  it("la vendedora ve por defecto solo sus chats y puede pasar a todos", () => {
    mockMe.level = "agent";
    render(<ConversationList selectedId={null} onSelect={jest.fn()} />);
    expect(last()).toMatchObject({ assigned: "me" });
    expect(last().assignedUserId).toBeUndefined();
    // La vendedora no filtra por otra vendedora.
    expect(screen.queryByLabelText("Vendedora")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ver chats"), { target: { value: "all" } });
    expect(last()).toMatchObject({ assigned: "all" });
  });

  it("el jefe ve todo y filtra por número o por vendedora", () => {
    mockMe.level = "admin";
    render(<ConversationList selectedId={null} onSelect={jest.fn()} />);
    expect(last()).toMatchObject({ assigned: "all" });
    expect(screen.queryByLabelText("Ver chats")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "acc-bea" } });
    expect(last()).toMatchObject({ channelAccountId: "acc-bea" });

    fireEvent.change(screen.getByLabelText("Vendedora"), { target: { value: "u-ana" } });
    expect(last()).toMatchObject({ channelAccountId: "acc-bea", assignedUserId: "u-ana" });
    // Nombres de correo: solo la parte antes de @.
    expect(screen.getByRole("option", { name: "ana" })).toBeInTheDocument();
  });

  it("cada conversación muestra su número cuando la empresa tiene varios", () => {
    mockMe.level = "admin";
    render(<ConversationList selectedId={null} onSelect={jest.fn()} />);
    const badges = screen.getAllByTestId("conv-number").map((el) => el.textContent);
    expect(badges).toEqual(["51900000001", "51900000002"]);
  });

  it("con un solo número no aparece la insignia ni el filtro de número", () => {
    mockMe.level = "admin";
    const saved = mockFilters.numbers;
    mockFilters.numbers = saved.slice(0, 1);
    try {
      render(<ConversationList selectedId={null} onSelect={jest.fn()} />);
      expect(screen.queryByTestId("conv-number")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Número")).not.toBeInTheDocument();
    } finally {
      mockFilters.numbers = saved;
    }
  });

  it("un indicador manda sobre «Mis chats» (Sin asignar)", () => {
    mockMe.level = "agent";
    render(<ConversationList selectedId={null} onSelect={jest.fn()} indicator="unassigned" />);
    expect(last()).toMatchObject({ assigned: "unassigned" });
  });
});
