import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveCheckoutDelivery from "../LiveCheckoutDelivery";
import { quoteLivePurchase, checkoutLivePurchase } from "../liveService";
import type { LiveReservation } from "../types";
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  quoteLivePurchase: jest.fn(),
  checkoutLivePurchase: jest.fn(),
}));
test("shipping that brings a saved-address boleta to S/700 reveals DNI and requotes automatically", async () => {
  (quoteLivePurchase as jest.Mock)
    .mockRejectedValueOnce({
      response: {
        data: {
          code: "RECEIPT_DNI_REQUIRED",
          total: 710,
          message: "Para una boleta desde S/ 700, escribe tu DNI de 8 dígitos.",
        },
      },
    })
    .mockResolvedValueOnce({ quoteId: "accepted", subtotal: 690, shipping: 20, total: 710 });
  render(
    <LiveCheckoutDelivery
      storeId="store"
      visitor="visitor"
      customer={{
        name: "Rosa",
        phone: "912345678",
        savedDelivery: {
          type: "HOME",
          courier: "MOTORIZADO",
          department: "Lima",
          province: "Lima",
          district: "Lima",
          address: "Calle de prueba 123",
        },
        savedReceipt: { type: "BOLETA" },
      }}
      reservations={[{ id: "hold", quantity: 1, unitPrice: 690 } as LiveReservation]}
      options={[]}
      methods={["yape"]}
      onClose={jest.fn()}
      onYape={jest.fn()}
    />,
  );
  const dni = await screen.findByLabelText("DNI para boleta");
  expect(screen.getByRole("button", { name: "Continuar a Yape →" })).toBeDisabled();
  fireEvent.change(dni, { target: { value: "45678901" } });
  await waitFor(() => expect(quoteLivePurchase).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Continuar a Yape →" })).toBeEnabled(),
  );
  expect((quoteLivePurchase as jest.Mock).mock.calls[1][2].receipt.dni).toBe("45678901");
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});
