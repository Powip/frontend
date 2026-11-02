import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveCheckoutDelivery from "../LiveCheckoutDelivery";
import { quoteLivePurchase, checkoutLivePurchase } from "../liveService";
import type { LiveDelivery, LiveReservation, StoreDeliveryOption } from "../types";
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  quoteLivePurchase: jest.fn(),
  checkoutLivePurchase: jest.fn(),
}));
beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
  });
});
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

const agency: StoreDeliveryOption = {
  id: "shalom-247",
  enabled: true,
  type: "AGENCY",
  courier: "SHALOM",
  department: "Cajamarca",
  province: "Cajamarca",
  district: "Los Baños Del Inca",
  agencyId: "247",
  agency: "Baños del Inca",
  price: 10,
};
const delivery: LiveDelivery = {
  type: "AGENCY",
  courier: "SHALOM",
  department: "Cajamarca",
  province: "Cajamarca",
  district: "Los Baños Del Inca",
  agencyId: "247",
  agency: "Baños del Inca",
  dni: "45678901",
};
const shippingError = {
  isAxiosError: true,
  response: {
    status: 503,
    data: {
      code: "SHIPPING_NOT_CONFIGURED",
      message: "La tienda no tiene un envío habilitado para este destino. Elige otra cobertura.",
    },
  },
};
function SavedCheckout({
  savedDelivery = delivery,
  options = [agency],
}: {
  savedDelivery?: LiveDelivery;
  options?: StoreDeliveryOption[];
}) {
  return (
    <LiveCheckoutDelivery
      storeId="store"
      visitor="visitor"
      customer={{ name: "Comprador de prueba", phone: "912345678", savedDelivery }}
      reservations={[{ id: "hold", quantity: 1, unitPrice: 234 } as LiveReservation]}
      options={options}
      methods={["yape"]}
      onClose={jest.fn()}
      onYape={jest.fn()}
    />
  );
}

test("a rejected saved agency reveals delivery fields and recovers with the matching district", async () => {
  (quoteLivePurchase as jest.Mock)
    .mockRejectedValueOnce(shippingError)
    .mockResolvedValueOnce({ quoteId: "valid-agency", subtotal: 234, shipping: 10, total: 244 });
  render(<SavedCheckout savedDelivery={{ ...delivery, district: "Cajamarca" }} />);
  const district = await screen.findByLabelText("Distrito");
  expect(screen.getByRole("alert")).toHaveTextContent(shippingError.response.data.message);
  expect(screen.getByLabelText("Agencia")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Continuar a Yape →" })).toBeDisabled();
  fireEvent.change(district, { target: { value: "Los Baños Del Inca" } });
  expect(screen.getByLabelText("Agencia")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Agencia"), { target: { value: "247" } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Continuar a Yape →" })).toBeEnabled(),
  );
  expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
  expect((quoteLivePurchase as jest.Mock).mock.calls[1][2].delivery).toEqual(delivery);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText(/Envío S\/\s10\.00/)).toBeInTheDocument();
});

test("a combined shipment authorized by the server still works when its old coverage was removed", async () => {
  (quoteLivePurchase as jest.Mock).mockResolvedValue({
    quoteId: "combined",
    subtotal: 234,
    shipping: 0,
    total: 234,
    combinedOrderNumber: "PED-TEST",
  });
  render(<SavedCheckout options={[]} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Continuar a Yape →" })).toBeEnabled(),
  );
  expect(screen.getByText(/No pagas envío otra vez/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cambiar entrega" })).toBeInTheDocument();
  expect(quoteLivePurchase).toHaveBeenCalledTimes(1);
  expect((quoteLivePurchase as jest.Mock).mock.calls[0][2].delivery).toEqual(delivery);
});

test("coverage rejected during checkout reveals the saved delivery and invalidates its quote", async () => {
  (quoteLivePurchase as jest.Mock).mockResolvedValue({
    quoteId: "expired-coverage",
    subtotal: 234,
    shipping: 10,
    total: 244,
  });
  (checkoutLivePurchase as jest.Mock).mockRejectedValue(shippingError);
  render(<SavedCheckout />);
  const pay = screen.getByRole("button", { name: "Continuar a Yape →" });
  await waitFor(() => expect(pay).toBeEnabled());
  fireEvent.click(pay);
  expect(await screen.findByLabelText("Distrito")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(shippingError.response.data.message);
  expect(pay).toBeDisabled();
  expect(screen.getByText("Envío según entrega")).toBeInTheDocument();
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
});
