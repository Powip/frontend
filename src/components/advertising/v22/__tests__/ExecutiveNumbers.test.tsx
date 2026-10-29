import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AdsExecutiveGroup, AdsSales, AdsSummary } from "@/services/advertisingV22Service";
import { ExecutiveNumbers } from "../ExecutiveNumbers";
import { executiveTotal } from "../executive-model";
import { money, pct } from "../model";
jest.mock("recharts", () => {
  const container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: container,
    ComposedChart: container,
    Bar: () => null,
    CartesianGrid: () => null,
    Line: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
const group = (extra: Partial<AdsExecutiveGroup> = {}): AdsExecutiveGroup => ({
  ...executiveTotal([]),
  orders: 10,
  confirmed: 8,
  delivered: 4,
  deliveredUnits: 8,
  orderRevenue: "1000",
  deliveredRevenue: "480",
  accountId: "a",
  storeId: "s",
  date: "2026-10-01",
  channel: "WHATSAPP",
  channelFamily: "messages",
  ...extra,
});
const make = () => {
  const metric = group(),
    flow = { totals: metric, byAccount: [metric], byChannel: [metric], daily: [metric] };
  const sales = {
    executive: {
      basis: "created",
      currency: "PEN",
      standard: flow,
      shopifyCod: null,
      quality: {},
      definitions: {},
    },
  } as AdsSales;
  const summary = {
    from: "2026-10-01",
    to: "2026-10-01",
    accounts: [
      { id: "a", name: "Cuenta", externalId: "123", currency: "PEN", timeZone: "America/Lima" },
    ],
    days: [],
    unassignedSpend: "20",
    quality: { spendAvailable: false },
  } as AdsSummary;
  return { sales, summary, flow };
};
const card = (label: string) => screen.getAllByText(label, { exact: true })[0].parentElement!;
it("shows matching delivered tickets and delivered/confirmed rate, hiding COD for normal businesses", () => {
  const data = make();
  render(<ExecutiveNumbers {...data} storeId="all" accountId="all" canSpend />);
  expect(
    within(card("Ticket promedio por pedido entregado")).getByText(
      (_, element) => element?.textContent === money(120),
    ),
  ).toBeInTheDocument();
  expect(
    within(card("Ticket promedio por unidad entregada")).getByText(
      (_, element) => element?.textContent === money(60),
    ),
  ).toBeInTheDocument();
  expect(within(card("Tasa de entrega")).getByText(pct(0.5))).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Shopify COD · Leads" })).not.toBeInTheDocument();
});
it("includes COD-only channels, converted sales and deliveries without folding leads into orders", () => {
  const data = make(),
    lead = group({
      orders: 5,
      confirmed: 2,
      delivered: 1,
      deliveredRevenue: "150",
      channel: "SHOPIFY",
      channelFamily: "web",
      unattributedOrders: 5,
    });
  data.sales.executive!.shopifyCod = {
    ...data.flow,
    totals: lead,
    daily: [lead],
    enabled: true,
    configurationKnown: true,
    storeIds: ["s"],
  };
  render(<ExecutiveNumbers {...data} storeId="all" accountId="all" canSpend />);
  expect(screen.getByRole("heading", { name: "Shopify COD · Leads" })).toBeInTheDocument();
  expect(within(card("Pedidos generados")).getByText("10")).toBeInTheDocument();
  const channel = screen.getByRole("rowheader", { name: "SHOPIFY" }).closest("tr")!;
  expect(
    within(channel)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["—", "0", "5", "2", "1", money(150), "—", "—", "—", "—"]);
  expect(screen.getByText(/Sin atribución publicitaria: 5 leads/)).toBeInTheDocument();
});
it("respects the store filter and financial capability", () => {
  const data = make();
  data.sales.executive!.standard.daily.push(group({ storeId: "other", orders: 99 }));
  render(<ExecutiveNumbers {...data} storeId="s" accountId="all" canSpend={false} />);
  expect(within(card("Pedidos generados")).getByText("10")).toBeInTheDocument();
  expect(screen.queryByText("Gasto publicitario")).not.toBeInTheDocument();
  expect(screen.queryByText("ROAS de pedidos")).not.toBeInTheDocument();
});
