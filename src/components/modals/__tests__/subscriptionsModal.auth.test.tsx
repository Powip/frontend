import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import SubscriptionModal from "../subscriptionsModal";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("axios");
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const plan = {
  id: "plan-1",
  name: "Basic",
  price: 99,
  description: "Plan mensual",
  durationInDays: 30,
  features: [],
};

describe("SubscriptionModal (Mercado Pago)", () => {
  afterEach(() => jest.clearAllMocks());

  it("crea la suscripción con la sesión (ms-subscription ya no acepta el alta sin token)", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ status: 201, data: {} });

    render(
      <SubscriptionModal
        open
        onClose={jest.fn()}
        plan={plan as never}
        userId="user-1"
        userEmail="ana@test.pe"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Pagar con Mercado Pago/ }));

    await waitFor(() =>
      expect(axiosAuth.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/subscriptions$/),
        expect.objectContaining({ userId: "user-1", planId: "plan-1" }),
      ),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
});
