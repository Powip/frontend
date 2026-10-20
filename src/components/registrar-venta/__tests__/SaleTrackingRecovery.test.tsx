import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { OrderHeader } from "@/interfaces/IOrder";
import { getSaleAssignment, getSaleOperation, persistSaleOperation, readSaleOperation, retrySaleAssignment } from "@/services/saleTrackingService";
import { PendingSaleRecovery, SaleAssignmentStatus } from "../SaleTrackingRecovery";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn(), put: jest.fn() } }));
jest.mock("@/services/saleTrackingService", () => ({ ...jest.requireActual("@/services/saleTrackingService"), getSaleAssignment: jest.fn(), getSaleOperation: jest.fn(), retrySaleAssignment: jest.fn() }));
const operation = { operationId: "same-uuid", method: "post" as const, url: `${GATEWAY.ventas}/order-header/manual`, payload: { operationId: "same-uuid", items: [{ unitIds: ["unit-a"] }] } };
const saved = { id: "saved", unitAssignmentStatus: "PENDING", stockVersion: 1, confirmedStockVersion: null } as OrderHeader;
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); persistSaleOperation("key", operation); });
test("timeout/reload reuses exact payload and UUID, then recovers already committed sale without another POST", async () => {
  jest.mocked(getSaleOperation).mockRejectedValue({ response: { status: 404 } });
  jest.mocked(axiosAuth.post).mockRejectedValue(new Error("timeout"));
  const onResolved = jest.fn();
  let view = render(<PendingSaleRecovery operation={operation} storageKey="key" onResolved={onResolved} onCorrect={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar y recuperar venta" }));
  await screen.findByRole("alert");
  expect(axiosAuth.post).toHaveBeenCalledWith(operation.url, operation.payload);
  expect(readSaleOperation("key")?.operationId).toBe("same-uuid");
  expect(screen.queryByRole("button", { name: "Corregir datos rechazados" })).not.toBeInTheDocument();
  view.unmount();
  jest.mocked(getSaleOperation).mockResolvedValue(saved);
  view = render(<PendingSaleRecovery operation={readSaleOperation("key")!} storageKey="key" onResolved={onResolved} onCorrect={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar y recuperar venta" }));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(saved));
  expect(axiosAuth.post).toHaveBeenCalledTimes(1); expect(readSaleOperation("key")).toBeNull();
});
test("a definitive rejection still checks operation before allowing corrections", async () => {
  jest.mocked(getSaleOperation).mockResolvedValue(saved);
  const onCorrect = jest.fn(); const onResolved = jest.fn();
  render(<PendingSaleRecovery operation={{ ...operation, definitiveRejection: true }} storageKey="key" onResolved={onResolved} onCorrect={onCorrect} />);
  fireEvent.click(screen.getByRole("button", { name: "Corregir datos rechazados" }));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(saved));
  expect(onCorrect).not.toHaveBeenCalled(); expect(axiosAuth.post).not.toHaveBeenCalled();
});
test("retry pending reservation queries acknowledgement and never repeats sale creation", async () => {
  jest.mocked(retrySaleAssignment).mockResolvedValue(saved);
  jest.mocked(getSaleAssignment).mockResolvedValue({ ...saved, unitAssignmentStatus: "CONFIRMED", confirmedStockVersion: 1 });
  render(<SaleAssignmentStatus order={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar reserva" }));
  await screen.findByText("Unidades confirmadas");
  expect(retrySaleAssignment).toHaveBeenCalledWith("saved");
  expect(axiosAuth.post).not.toHaveBeenCalled(); expect(axiosAuth.put).not.toHaveBeenCalled();
});


test("acknowledging a quantity hold offers selection without claiming complete unit assignment or retrying the hold", async () => {
  jest.mocked(getSaleAssignment).mockResolvedValue({ ...saved, unitCatalogValidated: true, unitStockState: "reserved", unitAssignmentStatus: "PENDING_SELECTION", confirmedStockVersion: 1 });
  render(<SaleAssignmentStatus order={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar confirmación" }));
  await screen.findByText("Stock reservado · falta asignar IMEI/serie");
  expect(screen.queryByText("Unidades confirmadas")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar reserva" })).not.toBeInTheDocument();
  expect(retrySaleAssignment).not.toHaveBeenCalled();
  expect(axiosAuth.post).not.toHaveBeenCalled();
  expect(axiosAuth.put).not.toHaveBeenCalled();
});
