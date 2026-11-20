import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CancelPurchaseDialog from "../CancelPurchaseDialog";

describe("CancelPurchaseDialog (FEAT-24 H0)", () => {
  it("no confirma con un motivo de menos de 5 caracteres", () => {
    const onConfirm = jest.fn();
    render(<CancelPurchaseDialog open purchaseNumber="COM-0007" onConfirm={onConfirm} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: " ok " } });
    expect(screen.getByRole("button", { name: "Anular compra" })).toBeDisabled();
  });

  it("confirma con el motivo recortado", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<CancelPurchaseDialog open purchaseNumber="COM-0007" onConfirm={onConfirm} onClose={jest.fn()} />);
    expect(screen.getByText(/COM-0007/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "  Error de carga " } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Error de carga"));
  });

  it("muestra el error del backend sin cerrarse", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn().mockRejectedValue({ response: { data: { message: "No hay stock suficiente para anular: SKU-1 tiene 3 y la compra sumó 5." } } });
    render(<CancelPurchaseDialog open purchaseNumber="COM-0007" onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Error de carga" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay stock suficiente para anular: SKU-1 tiene 3 y la compra sumó 5.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("un 423 de mes cerrado explica qué mes y qué hacer (FEAT-24 H10)", async () => {
    const onConfirm = jest.fn().mockRejectedValue({ response: { status: 423, data: { statusCode: 423, error: "Locked", code: "PERIODO_CERRADO", period: "2026-10", message: "El periodo 2026-10 está cerrado." } } });
    render(<CancelPurchaseDialog open purchaseNumber="COM-0007" onConfirm={onConfirm} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Error de carga" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Octubre 2026 está cerrado.");
    expect(alert).toHaveTextContent("registra un ajuste en el mes abierto o pide al Administrador que reabra el mes en Inventario › Cierre mensual.");
  });
});
