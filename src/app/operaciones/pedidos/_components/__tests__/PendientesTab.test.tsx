import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { PendientesTab } from "../PendientesTab";
import type { PedidosActions, Sale } from "../types";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/components/orders/OrderDetailModal", () => ({
  OrderDetailButton: ({ orderNumber }: { orderNumber: string }) => <button>Ver {orderNumber}</button>,
}));
const sale = (id: string, pendingPayment: number, overrides = {}) => ({
  id, orderNumber: `ORD-${id}`, clientName: `Cliente ${id}`, phoneNumber: "999999999", status: "PENDIENTE",
  pendingPayment, advancePayment: 100 - pendingPayment, total: 100, date: "23/10/2026", paymentMethod: "YAPE",
  salesRegion: "LIMA", deliveryType: "DOMICILIO", items: [], unitAssignmentStatus: "NONE", ...overrides,
}) as Sale;
const actions = () => ({
  can: () => true, onChangeStatus: jest.fn().mockResolvedValue(undefined), onBulkPrint: jest.fn(),
  onWhatsApp: jest.fn(), onOpenPayment: jest.fn(), isBulkLoading: false,
}) as unknown as PedidosActions;

beforeEach(() => jest.clearAllMocks());

it("keeps paid and unpaid orders pending, with separate payment labels and no guide action", () => {
  render(<PendientesTab sales={[sale("paid", 0), sale("debt", 100)]} actions={actions()} />);
  expect(screen.getAllByText("Pendiente")).toHaveLength(2);
  expect(screen.getByText("Pagado")).toBeInTheDocument();
  expect(screen.getByText("Con saldo")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Preparar" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);
  expect(screen.queryByRole("button", { name: /generar guía/i })).not.toBeInTheDocument();
});

it("prepares, prints and contacts an order with balance without requiring payment", async () => {
  const order = sale("debt", 0.01);
  const handlers = actions();
  render(<PendientesTab sales={[order]} actions={handlers} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar" }));
  await waitFor(() => expect(handlers.onChangeStatus).toHaveBeenCalledWith("debt", "PREPARADO"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Preparar" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
  expect(handlers.onBulkPrint).toHaveBeenCalledWith([order]);
  fireEvent.click(screen.getByTitle("WhatsApp"));
  expect(handlers.onWhatsApp).toHaveBeenCalledWith(order);
});

it("preserves stock reservation barriers for both preparation and printing", () => {
  render(<PendientesTab sales={[sale("tracked", 0, { hasTrackedUnits: true, unitAssignmentStatus: "PENDING" })]} actions={actions()} />);
  expect(screen.getByRole("button", { name: "Preparar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled();
  expect(screen.getByText(/reserva pendiente/i)).toBeInTheDocument();
});

it("reports a preparation rejection and restores the action", async () => {
  const handlers = actions();
  jest.mocked(handlers.onChangeStatus).mockRejectedValueOnce(new Error("network"));
  render(<PendientesTab sales={[sale("debt", 50)]} actions={handlers} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Preparar" })).toBeEnabled();
});

it("preserves dispatch permissions", () => {
  render(<PendientesTab sales={[sale("debt", 50)]} actions={{ ...actions(), can: () => false }} />);
  expect(screen.queryByRole("button", { name: "Preparar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Imprimir" })).not.toBeInTheDocument();
  expect(within(screen.getAllByRole("row")[1]).getByRole("button", { name: "Ver ORD-debt" })).toBeEnabled();
});

it("shows a confirmed purchase awaiting stock with its preparation link, without asking to confirm again", () => {
  render(<PendientesTab sales={[sale("confirmed", 179, { commercialStage: "SALE", commercialStockState: "DEFERRED", commercialLeadId: "lead-1", stockVersion: 0 })]} actions={actions()} />);
  expect(screen.getByText(/Compra confirmada. Prepara la reserva de stock/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Preparar reserva de stock" })).toHaveAttribute("href", "/leads-comerciales?leadId=lead-1");
  expect(screen.getByRole("button", { name: "Preparar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled();
});
