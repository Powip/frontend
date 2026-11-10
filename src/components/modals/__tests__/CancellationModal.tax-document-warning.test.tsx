import { render, screen } from "@testing-library/react";
import CancellationModal from "../CancellationModal";

const useActiveTaxDocumentForOrder = jest.fn();
jest.mock("@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order", () => ({
  useActiveTaxDocumentForOrder: (...args: unknown[]) => useActiveTaxDocumentForOrder(...args),
}));

const baseProps = { open: true, onClose: jest.fn(), orderNumber: "ORD-1", onConfirm: jest.fn() };

beforeEach(() => {
  useActiveTaxDocumentForOrder.mockReset();
  useActiveTaxDocumentForOrder.mockReturnValue(null);
});

it("avisa que anular el pedido no anula el comprobante y sugiere la nota de crédito", () => {
  useActiveTaxDocumentForOrder.mockReturnValue({
    taxDocumentType: "03",
    series: "B001",
    correlative: "00000012",
    cdrStatus: "ACCEPTED",
  });

  render(<CancellationModal {...baseProps} orderId="order-1" />);

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("boleta B001-00000012");
  expect(alert.textContent).toContain("emitida");
  expect(alert.textContent).toContain("nota de crédito");
  expect(useActiveTaxDocumentForOrder).toHaveBeenCalledWith("order-1", true);
});

it("dice 'en proceso' si SUNAT todavía no respondió y habla de factura cuando lo es", () => {
  useActiveTaxDocumentForOrder.mockReturnValue({
    taxDocumentType: "01",
    series: "F001",
    correlative: "00000003",
    cdrStatus: "PENDING",
  });

  render(<CancellationModal {...baseProps} orderId="order-1" />);

  expect(screen.getByRole("alert").textContent).toContain("factura F001-00000003 en proceso");
});

it("sin comprobante vigente no muestra aviso y la anulación sigue disponible", () => {
  render(<CancellationModal {...baseProps} orderId="order-1" />);

  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "Confirmar Anulación" })).toBeTruthy();
});

it("sin orderId (llamadores que no lo pasan) no consulta comprobantes", () => {
  render(<CancellationModal {...baseProps} />);

  expect(useActiveTaxDocumentForOrder).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});
