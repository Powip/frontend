import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OlvaNiubizPayment } from "@/features/olva/olva-shipment/models/olva-shipment";
import { OlvaNiubizCheckoutButton } from "../components/OlvaNiubizCheckoutButton";
import { buildNiubizCheckoutConfig } from "../utils/build-niubiz-checkout-config";

const { loadNiubizCheckoutScript, toast } = vi.hoisted(() => ({
  loadNiubizCheckoutScript: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../utils/load-niubiz-checkout-script", () => ({ loadNiubizCheckoutScript }));
vi.mock("sonner", () => ({ toast }));

const payment: OlvaNiubizPayment = {
  method: "niubiz",
  amount: 7.5,
  currency: "PEN",
  sessionKey: "secret-session-key",
  merchantId: "650169889",
  checkoutScriptUrl: "https://static-content.vnforapps.com/v2/js/checkout.js",
  expiresAt: new Date("2026-11-04T18:29:26.421Z"),
};

describe("buildNiubizCheckoutConfig", () => {
  const now = new Date("2026-11-04T18:00:00.000Z");

  it("builds the form configuration from the session and the registration number", () => {
    const config = buildNiubizCheckoutConfig({
      payment,
      registrationNumber: "202600777245",
      onComplete: vi.fn(),
      now,
    });

    expect(config).toMatchObject({
      sessiontoken: "secret-session-key",
      merchantid: "650169889",
      channel: "web",
      purchasenumber: "202600777245",
      amount: 7.5,
      expirationminutes: 20,
    });
  });

  it("never offers more minutes than the session has left", () => {
    const config = buildNiubizCheckoutConfig({
      payment: { ...payment, expiresAt: new Date("2026-11-04T18:05:30.000Z") },
      registrationNumber: "202600777245",
      onComplete: vi.fn(),
      now,
    });

    expect(config?.expirationminutes).toBe(5);
  });

  it.each([
    ["without a registration number", { registrationNumber: null }],
    ["without a session key", { payment: { ...payment, sessionKey: undefined } }],
    ["without an amount", { payment: { ...payment, amount: undefined } }],
  ])("returns null %s", (_label, override) => {
    expect(
      buildNiubizCheckoutConfig({
        payment,
        registrationNumber: "202600777245",
        onComplete: vi.fn(),
        now,
        ...override,
      }),
    ).toBeNull();
  });
});

describe("OlvaNiubizCheckoutButton", () => {
  const configure = vi.fn();
  const open = vi.fn();

  const renderButton = (props: Partial<Parameters<typeof OlvaNiubizCheckoutButton>[0]> = {}) => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <OlvaNiubizCheckoutButton
          payment={{ ...payment, expiresAt: new Date(Date.now() + 10 * 60_000) }}
          registrationNumber="202600777245"
          {...props}
        />
      </QueryClientProvider>,
    );

    return { queryClient, user: userEvent.setup({ delay: null }) };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loadNiubizCheckoutScript.mockResolvedValue(undefined);
    window.VisanetCheckout = { configure, open };
  });

  afterEach(() => {
    window.VisanetCheckout = undefined;
  });

  it("loads the script, configures the form and opens it", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: /Pagar con tarjeta/ }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(loadNiubizCheckoutScript).toHaveBeenCalledWith(payment.checkoutScriptUrl);
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({
        sessiontoken: "secret-session-key",
        purchasenumber: "202600777245",
      }),
    );
  });

  it("refreshes the shipments when the form completes", async () => {
    const { user, queryClient } = renderButton();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: /Pagar con tarjeta/ }));
    await waitFor(() => expect(configure).toHaveBeenCalled());

    configure.mock.calls[0][0].complete({});

    expect(invalidate).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it("tells the user when the form cannot be loaded", async () => {
    loadNiubizCheckoutScript.mockRejectedValue(
      new Error("No se pudo cargar el formulario de pago."),
    );
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: /Pagar con tarjeta/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo cargar el formulario de pago."),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("renders nothing once the payment has no session", () => {
    renderButton({ payment: { method: "niubiz", paid: true } });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
