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
});
