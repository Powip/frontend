import { fireEvent, render, screen } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";
import { SaleUnitLifecycleButtons } from "../SaleUnitLifecycleActions";

jest.mock("../SaleUnitLifecycleModal", () => ({ __esModule: true, default: () => null }));
const order = { id: "order", status: "EN_ENVIO", hasTrackedUnits: true, items: [{ trackingMode: "IMEI" }] } as OrderHeader;

test("order details offer explicit physical return for units still in transit", () => {
  const onAction = jest.fn();
  render(<SaleUnitLifecycleButtons order={order} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar retorno físico" }));
  expect(onAction).toHaveBeenCalledWith("return");
});
test("NONE order details do not add a serialized return action", () => {
  render(<SaleUnitLifecycleButtons order={{ ...order, hasTrackedUnits: false, unitAssignmentStatus: "NONE", items: [] }} onAction={jest.fn()} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("delivered and cancelled tracked orders preserve their existing dedicated actions", () => {
  const onAction = jest.fn();
  const view = render(<SaleUnitLifecycleButtons order={{ ...order, status: "ENTREGADO" }} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "Devolver venta completa" }));
  expect(onAction).toHaveBeenLastCalledWith("return");
  view.rerender(<SaleUnitLifecycleButtons order={{ ...order, status: "ANULADO" }} onAction={onAction} />);
  fireEvent.click(screen.getByRole("button", { name: "Reactivar con IMEI / series" }));
  expect(onAction).toHaveBeenLastCalledWith("reactivate");
});
