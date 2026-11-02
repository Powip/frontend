import { fireEvent, render, screen } from "@testing-library/react";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import ScannerSheet from "../ScannerSheet";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

function setup(status: OrderStatus) {
  const order = { id: "order", orderNumber: "ORD-1", guideNumber: "GUIA-1", status,
    customer: { fullName: "Cliente" }, grandTotal: "100", payments: [] } as unknown as OrderHeader;
  const onDispatch = jest.fn().mockResolvedValue(undefined);
  const onConfirmDelivery = jest.fn().mockResolvedValue(undefined);
  render(<ScannerSheet open onOpenChange={jest.fn()} orders={[order]} onDispatch={onDispatch} onConfirmDelivery={onConfirmDelivery} />);
  const scan = () => {
    fireEvent.change(screen.getByPlaceholderText("ORD-XXXXXX / N° guía"), { target: { value: "ORD-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Escanear" }));
  };
  return { order, scan, onDispatch, onConfirmDelivery };
}

it("dispatches only after guide approval and reports the physical handoff", async () => {
  const { order, scan, onDispatch, onConfirmDelivery } = setup("EN_ENVIO");
  scan();
  expect(await screen.findByText("Despachado · en tránsito")).toBeInTheDocument();
  expect(onDispatch).toHaveBeenCalledWith(order);
  expect(onConfirmDelivery).not.toHaveBeenCalled();
});

it.each(["PREPARADO", "ASIGNADO_A_GUIA", "DESPACHADO"] as const)("does not dispatch %s again or before approval", async (status) => {
  const { scan, onDispatch } = setup(status);
  scan();
  expect(await screen.findByText(`Estado actual (${status}) no permite despacho`)).toBeInTheDocument();
  expect(onDispatch).not.toHaveBeenCalled();
});

it.each(["EN_ENVIO", "DESPACHADO"] as const)("confirms actual delivery from %s even with an unpaid balance", async (status) => {
  const { order, scan, onDispatch, onConfirmDelivery } = setup(status);
  fireEvent.click(screen.getByRole("button", { name: /Confirmar entrega/ }));
  scan();
  expect(await screen.findByText("Entrega confirmada")).toBeInTheDocument();
  expect(onConfirmDelivery).toHaveBeenCalledWith(order);
  expect(onDispatch).not.toHaveBeenCalled();
  expect(order.payments).toEqual([]);
});
