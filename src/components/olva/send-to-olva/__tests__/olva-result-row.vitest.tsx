import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaShipment } from "@/features/olva/olva-shipment/mappers/to-olva-shipment";
import { buildOlvaShipmentResponse } from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";
import { OlvaResultRow } from "../components/OlvaResultRow";
import { buildBulkResult, buildOrderDetail } from "../test-utils/send-to-olva.fixtures";

const { getOlvaShipment, getOlvaShipmentLabel, openOlvaLabel, regenerateOlvaShipmentPaymentLink } =
  vi.hoisted(() => ({
    getOlvaShipment: vi.fn(),
    getOlvaShipmentLabel: vi.fn(),
    openOlvaLabel: vi.fn(),
    regenerateOlvaShipmentPaymentLink: vi.fn(),
  }));

vi.mock("@/features/olva/olva-shipment/services/olva-shipment.service", () => ({
  getOlvaShipment,
  getOlvaShipmentLabel,
  regenerateOlvaShipmentPaymentLink,
}));
vi.mock("../utils/open-olva-label", () => ({ openOlvaLabel }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const order = buildOrderDetail();

function renderRow(result: ReturnType<typeof buildBulkResult>["results"][number]) {
  const onShareWhatsApp = vi.fn();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <OlvaResultRow result={result} order={order} onShareWhatsApp={onShareWhatsApp} />
    </QueryClientProvider>,
  );

  return { onShareWhatsApp, user: userEvent.setup({ delay: null }) };
}

describe("OlvaResultRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openOlvaLabel.mockReturnValue(true);
    getOlvaShipment.mockResolvedValue(toOlvaShipment(buildOlvaShipmentResponse()));
  });

  it("opens the label that came with the creation answer without asking Olva again", async () => {
    const { user } = renderRow(buildBulkResult([{ key: "order-1", status: "created" }]).results[0]);

    await user.click(screen.getByRole("button", { name: /Rótulo Olva/ }));

    expect(openOlvaLabel).toHaveBeenCalledWith(expect.objectContaining({ filename: "guia.pdf" }));
    expect(getOlvaShipmentLabel).not.toHaveBeenCalled();
  });

  it("asks Olva for the label when the creation answer did not carry it", async () => {
    const [result] = buildBulkResult([{ key: "order-1", status: "created" }]).results;

    if (result.status !== "created") throw new Error("expected a created result");

    getOlvaShipmentLabel.mockResolvedValue({
      filename: "otra.pdf",
      mimeType: "application/pdf",
      pdfBase64: "JVBERg==",
    });

    const { user } = renderRow({ ...result, label: null });

    await user.click(screen.getByRole("button", { name: /Rótulo Olva/ }));

    await waitFor(() => expect(getOlvaShipmentLabel).toHaveBeenCalledWith(result.shipment.id));
    expect(openOlvaLabel).toHaveBeenCalledWith(expect.objectContaining({ filename: "otra.pdf" }));
  });

  it("tells the user when the browser blocked the label window", async () => {
    openOlvaLabel.mockReturnValue(false);

    const { user } = renderRow(buildBulkResult([{ key: "order-1", status: "created" }]).results[0]);

    await user.click(screen.getByRole("button", { name: /Rótulo Olva/ }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("bloqueó"));
  });

  it("shares the tracking number with the customer over WhatsApp", async () => {
    const { user, onShareWhatsApp } = renderRow(
      buildBulkResult([{ key: "order-1", status: "created" }]).results[0],
    );

    await user.click(screen.getByRole("button", { name: /WhatsApp/ }));

    expect(onShareWhatsApp).toHaveBeenCalledWith(order, "123456789012");
  });

  const createdWith = (shipment: ReturnType<typeof buildOlvaShipmentResponse>) => {
    const [result] = buildBulkResult([{ key: "order-1", status: "created" }]).results;

    if (result.status !== "created") throw new Error("expected a created result");

    return { ...result, shipment: toOlvaShipment(shipment) };
  };

  it("links to the payment page of a PagoEfectivo shipment, with its CIP code", () => {
    renderRow(
      createdWith(
        buildOlvaShipmentResponse({
          status: "PENDING_PAYMENT",
          payment: { method: "pagoefectivo", url: "https://pay.test/abc", cipCode: "CIP-123" },
        }),
      ),
    );

    expect(screen.getByRole("link", { name: /Link de pago/ })).toHaveAttribute(
      "href",
      "https://pay.test/abc",
    );
    expect(screen.getByText("CIP-123")).toBeInTheDocument();
    expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
  });

  it("offers card payment for a Niubiz shipment instead of a link, and never prints its credentials", () => {
    renderRow(
      createdWith(
        buildOlvaShipmentResponse({
          status: "PENDING_PAYMENT",
          payment: {
            method: "niubiz",
            sessionKey: "secret-session-key",
            merchantId: "merchant-1",
            checkoutScriptUrl: "https://checkout.test/niubiz.js",
          },
        }),
      ),
    );

    expect(screen.queryByRole("link", { name: /Link de pago/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar con tarjeta/ })).toBeEnabled();
    expect(screen.queryByText(/secret-session-key/)).not.toBeInTheDocument();
  });

  it("follows a shipment that waits for payment and shows it as paid once Olva confirms", async () => {
    const pending = buildOlvaShipmentResponse({
      status: "PENDING_PAYMENT",
      payment: {
        method: "niubiz",
        sessionKey: "k",
        merchantId: "m",
        checkoutScriptUrl: "https://c.test/n.js",
      },
    });

    getOlvaShipment.mockResolvedValue(
      toOlvaShipment(
        buildOlvaShipmentResponse({
          id: pending.id,
          status: "REGISTERED",
          payment: { method: "niubiz", paid: true },
        }),
      ),
    );

    renderRow(createdWith(pending));

    expect(await screen.findByText("Pagado")).toBeInTheDocument();
    expect(getOlvaShipment).toHaveBeenCalledWith(pending.id);
    expect(screen.queryByRole("button", { name: /Pagar con tarjeta/ })).not.toBeInTheDocument();
  });

  it("does not poll a shipment that is not waiting for payment", () => {
    renderRow(createdWith(buildOlvaShipmentResponse({ status: "REGISTERED" })));

    expect(getOlvaShipment).not.toHaveBeenCalled();
  });

  it("lets the user ask for a new payment when it expired", async () => {
    const expired = buildOlvaShipmentResponse({ status: "PAYMENT_EXPIRED" });

    getOlvaShipment.mockResolvedValue(toOlvaShipment(expired));
    regenerateOlvaShipmentPaymentLink.mockResolvedValue(toOlvaShipment(expired));

    const { user } = renderRow(createdWith(expired));

    await user.click(await screen.findByRole("button", { name: /Generar nuevo pago/ }));

    // TanStack passes extra context after the variable, so only the first argument is compared
    await waitFor(() => expect(regenerateOlvaShipmentPaymentLink).toHaveBeenCalled());
    expect(regenerateOlvaShipmentPaymentLink.mock.calls[0][0]).toBe(expired.id);
  });

  it("shows the reason Olva gave for a rejection instead of a generic sentence", () => {
    renderRow(buildBulkResult([{ key: "order-1", status: "failed" }]).results[0]);

    expect(screen.getByText("Falló")).toBeInTheDocument();
    expect(screen.getByText("Rechazado")).toBeInTheDocument();
    expect(screen.queryByText("Olva rechazó el envío.")).not.toBeInTheDocument();
  });

  it("marks an order that already has a shipment as taken, not as an error to retry", () => {
    renderRow(
      buildBulkResult([{ key: "order-1", status: "failed", code: "SHIPMENT_ALREADY_EXISTS" }])
        .results[0],
    );

    expect(screen.getByText("Ya enviado")).toBeInTheDocument();
    expect(screen.getByText("Este pedido ya tiene un envío de Olva activo.")).toBeInTheDocument();
  });

  it("warns never to resend what Olva registered but could not be saved", () => {
    renderRow(buildBulkResult([{ key: "order-1", status: "registered_not_saved" }]).results[0]);

    expect(screen.getByText("Registrado sin guardar")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No lo envíes de nuevo");
    expect(screen.getByText("999999999999")).toBeInTheDocument();
  });
});
