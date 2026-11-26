import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MyDay from "../MyDay";
import { getTeamDay } from "@/services/crmTeamService";
import type { TeamDay } from "@/types/crmTeam";

jest.mock("@/services/crmTeamService", () => ({ getTeamDay: jest.fn() }));
const me = { isSupervisor: true };
jest.mock("@/hooks/useCrmMe", () => ({ useCrmMe: () => me }));

const day = (over: Partial<TeamDay> = {}): TeamDay => ({
  who: "all",
  goal: 2000,
  count: 3,
  units: 5,
  billed: 600,
  collectedFull: 230,
  deposits: 30,
  depositOrders: 1,
  pending: 340,
  pendingToValidate: 115,
  pendingOnDelivery: 225,
  sellers: [
    { userId: "u1", userName: "Karla Alva" },
    { userId: "pau", userName: "Pau" },
  ],
  orders: [
    { orderId: "o1", orderNumber: "ORD-1", storeId: "s", conversationId: "c1", customerName: "Ana", sellerId: "pau", sellerName: "Pau", units: 2, total: 230, paid: 230, pending: 0, state: "paid", createdAt: "" },
    { orderId: "o2", orderNumber: "ORD-2", storeId: "s", conversationId: null, customerName: "Luis", sellerId: "u1", sellerName: "Karla Alva", units: 1, total: 255, paid: 30, pending: 225, state: "deposit", createdAt: "" },
    { orderId: "o3", orderNumber: "ORD-3", storeId: "s", conversationId: null, customerName: "Rosa", sellerId: "u1", sellerName: "Karla Alva", units: 2, total: 115, paid: 0, pending: 115, state: "to_validate", createdAt: "" },
  ],
  ...over,
});

const setup = (onOpenChat = jest.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MyDay onOpenChat={onOpenChat} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  me.isSupervisor = true;
  (getTeamDay as jest.Mock).mockResolvedValue(day());
});

describe("Mi día (mockup 152)", () => {
  it("pinta meta y las 5 tarjetas con datos del servidor", async () => {
    setup();
    const g = within(await screen.findByRole("group", { name: "Resumen del día" }));
    expect(g.getByText("Ventas (pedidos)").parentElement).toHaveTextContent("3");
    expect(g.getByText("Unidades").parentElement).toHaveTextContent(/1[.,]7 por pedido/);
    expect(g.getByText("Facturación").parentElement).toHaveTextContent("S/ 600");
    expect(g.getByText("Adelantos").parentElement).toHaveTextContent("1 pedido · clave retenida");
    expect(g.getByText("Por cobrar").parentElement).toHaveTextContent("S/ 115 por validar");
    expect(screen.getByText(/de la meta S\/ 2,000/)).toHaveTextContent("30 %");
    expect(getTeamDay).toHaveBeenCalledWith("all");
  });

  it("el supervisor elige vendedora y Pau aparece como vendedora", async () => {
    setup();
    const sel = await screen.findByLabelText("Ver números de");
    expect(within(sel).getByRole("option", { name: "Pau" })).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: "pau" } });
    await waitFor(() => expect(getTeamDay).toHaveBeenCalledWith("pau"));
  });

  it("el desplegable muestra las ventas de cada vendedora contra su meta", async () => {
    (getTeamDay as jest.Mock).mockResolvedValue(
      day({
        sellers: [
          { userId: "u1", userName: "Karla Alva", count: 2, billed: 370, goal: 1000 },
          { userId: "pau", userName: "Pau", count: 1, billed: 230, goal: 1000 },
        ],
      }),
    );
    setup();
    const sel = await screen.findByLabelText("Ver números de");
    expect(within(sel).getByRole("option", { name: "Karla Alva · S/ 370 de S/ 1,000" })).toBeInTheDocument();
    expect(within(sel).getByRole("option", { name: "Pau · S/ 230 de S/ 1,000" })).toBeInTheDocument();
  });

  it("la vendedora no elige: ve solo lo suyo", async () => {
    me.isSupervisor = false;
    (getTeamDay as jest.Mock).mockResolvedValue(day({ who: "u1" }));
    setup();
    expect(await screen.findByText("Mi día")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ver números de")).not.toBeInTheDocument();
    expect(getTeamDay).toHaveBeenCalledWith(undefined);
  });

  it("«Ver ventas de hoy» lista los pedidos y abre el chat", async () => {
    const open = jest.fn();
    setup(open);
    fireEvent.click(await screen.findByRole("button", { name: /Ver ventas de hoy/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText("Total · 3 pedidos")).toBeInTheDocument();
    fireEvent.click(dlg.getByRole("tab", { name: "Con adelanto" }));
    expect(dlg.queryByText("ORD-1")).not.toBeInTheDocument();
    fireEvent.click(dlg.getByRole("tab", { name: /Todas/ }));
    fireEvent.click(dlg.getByText("ORD-1"));
    expect(open).toHaveBeenCalledWith("c1");
  });
});
