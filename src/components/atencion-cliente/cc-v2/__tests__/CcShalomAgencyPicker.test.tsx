/* eslint-disable @typescript-eslint/no-require-imports */
/** Agencia Shalom OPCIONAL en Gestión CC. HTTP con mock: nada sale a Shalom ni al backend. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CcSaleConfirmationPanel } from "../CcSaleConfirmationPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmCommercialOrderPurchase,
  getCommercialLeadConfirmationCapabilities,
} from "@/services/commercialLeadsService";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import type { LeadConfirmationResponse } from "@/types/leads";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/commercialLeadsService", () => ({
  confirmCommercialOrderPurchase: jest.fn(),
  getCommercialLeadConfirmationCapabilities: jest.fn(),
  commercialLeadError: (error: unknown) => (error instanceof Error ? error.message : "No se pudo."),
}));
jest.mock("@/utils/commercialOrders", () => ({
  ...jest.requireActual("@/utils/commercialOrders"),
  notifyCommercialChange: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://integrations/" } }));
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  function text(node: any): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    return Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  }
  function Select({ value, onValueChange, children, disabled }: any) {
    const options: Array<{ value: string; label: string }> = [];
    function visit(nodes: any) {
      React.Children.forEach(nodes, (node: any) => {
        if (!React.isValidElement(node)) return;
        const props = node.props as any;
        if (props.value !== undefined) options.push({ value: props.value, label: text(props.children) });
        else visit(props.children);
      });
    }
    visit(children);
    return <select aria-label="Agencia" value={value ?? ""} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value)}>
      <option value="">Selecciona</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  const Pass = ({ children }: any) => <>{children}</>;
  return { Select, SelectContent: Pass, SelectTrigger: Pass, SelectItem: Pass, SelectValue: () => null };
});

const get = axiosAuth.get as jest.Mock;
const put = axiosAuth.put as jest.Mock;
const raw = (id: number, nombre: string, extra: Record<string, unknown> = {}) =>
  ({ ter_id: id, nombre, lugar_over: `${nombre} API`, lugar: `Dirección ${id}`, ter_aereo: 0, departamento: "LIMA", provincia: "LIMA", ...extra });
const CATALOG = [
  raw(1, "MIRAFLORES OVALO"),
  raw(2, "SURCO CHACARILLA"),
  raw(4, "CUSCO WANCHAQ", { departamento: "CUSCO", provincia: "CUSCO" }),
];
const MIRAFLORES = { department: "Lima", province: "Lima", district: "Miraflores" };
const SUCCESS = { lead: { id: "lead-1", status: "CONVERTIDO" }, order: { id: "order-1" }, replayed: false } as unknown as LeadConfirmationResponse;
const ACCEPTANCE_LABEL = "El cliente aceptó los productos y el total del pedido";
const clients: QueryClient[] = [];

type PanelProps = React.ComponentProps<typeof CcSaleConfirmationPanel>;
function renderPanel(shalomAgency: PanelProps["shalomAgency"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const onUpdated = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <CcSaleConfirmationPanel
        orderId="order-1"
        commercialLeadId="lead-1"
        orderUpdatedAt="2026-10-22T22:20:00.000Z"
        datosCompletos
        onUpdated={onUpdated}
        shalomAgency={shalomAgency}
      />
    </QueryClientProvider>,
  );
  return { onUpdated };
}
const select = () => screen.getByRole("combobox", { name: "Agencia" });
const optionNames = () => within(select()).getAllByRole("option").slice(1).map((option) => option.getAttribute("value"));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { company: { id: "company-1" }, user: { id: "u1", name: "Ana", authorizationVerified: true, authorizationCompanyId: "company-1", permissions: ["MANAGE_CUSTOMER_SERVICE", "CONFIRM_SALE"] } },
    hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(confirmCommercialOrderPurchase).mockResolvedValue(SUCCESS);
  get.mockResolvedValue({ data: { success: true, total: CATALOG.length, data: CATALOG } });
  put.mockResolvedValue({ data: {} });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe("Gestión CC — agencia Shalom opcional", () => {
  it("confirma la venta sin elegir agencia: no guarda nada en el pedido", async () => {
    const { onUpdated } = renderPanel({ location: MIRAFLORES, current: null, editable: true });
    const user = userEvent.setup();
    await waitFor(() => expect(optionNames().length).toBeGreaterThan(0));

    await user.click(await screen.findByRole("button", { name: "Confirmar venta" }));
    await user.click(screen.getByRole("checkbox", { name: ACCEPTANCE_LABEL }));
    await user.click(screen.getByRole("button", { name: "Confirmar y continuar aquí" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(confirmCommercialOrderPurchase).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });

  it("con ciudad lista solo las agencias de esa ciudad", async () => {
    renderPanel({ location: MIRAFLORES, current: null, editable: true });
    await waitFor(() => expect(optionNames().length).toBeGreaterThan(0));
    expect(optionNames()).toEqual(["MIRAFLORES OVALO API"]);
  });

  it("sin ciudad el selector queda deshabilitado y pide completar la ciudad", async () => {
    renderPanel({ location: { department: "", province: "", district: "" }, current: null, editable: true });
    expect(await screen.findByText(/Primero completa la ciudad del pedido/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Agencia" })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeEnabled();
  });

  it("al elegir una agencia la guarda en el pedido como PUNTO_EXTERNO y refresca", async () => {
    const { onUpdated } = renderPanel({ location: MIRAFLORES, current: null, editable: true });
    const user = userEvent.setup();
    await waitFor(() => expect(optionNames().length).toBeGreaterThan(0));

    await user.selectOptions(select(), "MIRAFLORES OVALO API");

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/manual\/order-1\/full$/), {
      deliveryType: "PUNTO_EXTERNO",
      delivery: { agency: "Shalom — MIRAFLORES OVALO" },
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalled();
    expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
    expect(await screen.findByText("Shalom — MIRAFLORES OVALO")).toBeInTheDocument();
  });

  it("si el backend rechaza el guardado avisa y no refresca", async () => {
    put.mockRejectedValue(new Error("ORDER_DELIVERY_DISPATCH_LOCKED"));
    const { onUpdated } = renderPanel({ location: MIRAFLORES, current: null, editable: true });
    const user = userEvent.setup();
    await waitFor(() => expect(optionNames().length).toBeGreaterThan(0));

    await user.selectOptions(select(), "MIRAFLORES OVALO API");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ORDER_DELIVERY_DISPATCH_LOCKED"));
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
