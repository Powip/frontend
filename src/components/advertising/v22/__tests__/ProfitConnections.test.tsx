import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdsSales } from "@/services/advertisingV22Service";
import { useAdsV22 } from "../context";
import { ProfitConnections } from "../ProfitConnections";

jest.mock("../context", () => ({ useAdsV22: jest.fn() }));
jest.mock("next/dynamic", () => () =>
  function OrdersPanel(props: { from: string; to: string; companyId: string; actorId: string }) {
    return (
      <div data-testid="orders-review">
        {props.from} / {props.to} / {props.companyId} / {props.actorId}
      </div>
    );
  },
);

const sales: AdsSales = {
  source: "powip-orders-v22",
  from: "2026-10-01",
  to: "2026-10-16",
  currency: "PEN",
  totals: {
    orders: 10, units: 13, confirmed: 8, delivered: 6, inTransit: 2,
    deliveredUnits: 7, cancelled: 1, billedRevenue: "592.50",
    productCost: null, shippingCost: null, eligibleRevenue: "0",
    eligibleProductCost: "0", eligibleShippingCost: "0",
    missingCostOrders: 6, attributedOrders: 0,
  },
  byStore: [], byChannel: [], byProduct: [], byAd: [], daily: [],
  deliveryHistory: [], productVelocity: [], quality: {},
};
const props = {
  from: sales.from,
  to: sales.to,
  sales,
  loading: false,
  error: null,
  onSection: jest.fn(),
};
function identity(profit = true, configure = true) {
  jest.mocked(useAdsV22).mockReturnValue({
    identity: { token: "test-token", companyId: "company-a" },
    actorId: "actor-a",
    settings: { capabilities: { view: true, spend: true, profit, configure, edit: true } },
  } as ReturnType<typeof useAdsV22>);
}
beforeEach(() => {
  jest.clearAllMocks();
  identity();
});

it("shows actual recognized revenue without inventing cost or ad attribution", () => {
  render(<ProfitConnections {...props} />);
  expect(screen.getByText(/592\.50/)).toBeInTheDocument();
  expect(screen.getByText("0 de 10")).toBeInTheDocument();
  expect(screen.getByText("Pedidos facturados con costos pendientes")).toBeInTheDocument();
  expect(screen.getByText(/El costo actual del catálogo no reemplaza el costo histórico/)).toBeInTheDocument();
  expect(screen.queryByTestId("orders-review")).not.toBeInTheDocument();
});

it("opens existing audited review only on request and preserves selected dates and identity", async () => {
  const user = userEvent.setup();
  render(<ProfitConnections {...props} />);
  await user.click(screen.getByRole("button", { name: "Revisar anuncios y costos de pedidos" }));
  expect(screen.getByTestId("orders-review")).toHaveTextContent(
    "2026-10-01 / 2026-10-16 / company-a / actor-a",
  );
  expect(screen.getByText(/Esta revisión ampliada incluye todos los canales y pedidos aún incompletos/)).toHaveTextContent(
    /cinco rubros.*producto y envío pendientes sólo en pedidos facturados de Web y Mensajes/,
  );
});

it("does not expose financial reviews or pending-cost counts to a role without profit access", () => {
  identity(false, false);
  render(<ProfitConnections {...props} />);
  expect(screen.queryByRole("button", { name: "Revisar anuncios y costos de pedidos" })).not.toBeInTheDocument();
  expect(screen.queryByText("Pedidos facturados con costos pendientes")).not.toBeInTheDocument();
  expect(screen.queryByTestId("orders-review")).not.toBeInTheDocument();
});

it("offers the existing product and source links without automatically assigning sales", async () => {
  const user = userEvent.setup();
  render(<ProfitConnections {...props} />);
  await user.click(screen.getByRole("button", { name: "Vincular productos con anuncios" }));
  expect(props.onSection).toHaveBeenCalledWith("products");
  await user.click(screen.getByRole("button", { name: "Conectar el origen de las ventas" }));
  expect(props.onSection).toHaveBeenCalledWith("measurement");
  expect(screen.queryByTestId("orders-review")).not.toBeInTheDocument();
});
