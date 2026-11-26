import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaShipment } from "@/features/olva/olva-shipment/mappers/to-olva-shipment";
import { toOlvaShipmentSummary } from "@/features/olva/olva-shipment/mappers/to-olva-shipment-summary";
import type {
  OlvaShipment,
  OlvaShipmentSummary,
} from "@/features/olva/olva-shipment/models/olva-shipment";
import {
  buildOlvaShipmentListItemResponse,
  buildOlvaShipmentResponse,
} from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";
import { buildOlvaAxiosError } from "@/features/olva/shared/test-utils/axios-error";
import { OlvaShipmentCell } from "../OlvaShipmentCell";

const services = vi.hoisted(() => ({
  getOlvaShipment: vi.fn(),
  getOlvaShipmentLabel: vi.fn(),
  regenerateOlvaShipmentPaymentLink: vi.fn(),
  retryOlvaShipment: vi.fn(),
  discardOlvaShipment: vi.fn(),
}));
const { openOlvaLabel } = vi.hoisted(() => ({ openOlvaLabel: vi.fn() }));

vi.mock("@/features/olva/olva-shipment/services/olva-shipment.service", () => services);
vi.mock("../send-to-olva/utils/open-olva-label", () => ({ openOlvaLabel }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const ID = "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b";

function renderCell(shipment: OlvaShipment | OlvaShipmentSummary | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup({ delay: null });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <OlvaShipmentCell shipment={shipment} />
    </QueryClientProvider>,
  );

  return { ...view, user };
}

const pendingPagoEfectivo = (expiresAt: Date) =>
  buildOlvaShipmentResponse({
    status: "PENDING_PAYMENT",
    payment: {
      method: "pagoefectivo",
      url: "https://pay.test/abc",
      cipCode: "CIP-123",
      qrImage: "data:image/png;base64,QUJD",
      expiresAt: expiresAt.toISOString(),
    },
  });

describe("OlvaShipmentCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openOlvaLabel.mockReturnValue(true);
  });

  it("renders nothing for an order without an Olva shipment", () => {
    const { container } = renderCell(null);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the status in Spanish and the guide, and opens its label", async () => {
    const label = { filename: "g.pdf", mimeType: "application/pdf", pdfBase64: "JVBERg==" };
    services.getOlvaShipmentLabel.mockResolvedValue(label);

    const { user } = renderCell(
      toOlvaShipmentSummary(buildOlvaShipmentListItemResponse({ status: "IN_TRANSIT" })),
    );

    expect(screen.getByText("En tránsito")).toBeInTheDocument();
    expect(screen.getByText("123456789012")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Rótulo/ }));

    await waitFor(() => expect(openOlvaLabel).toHaveBeenCalledWith(label));
    expect(services.getOlvaShipmentLabel).toHaveBeenCalledWith(ID);
    // Only a shipment that waits for payment is followed
    expect(services.getOlvaShipment).not.toHaveBeenCalled();
  });

  it("a pending PagoEfectivo payment: the CIP to copy, the link, the QR and when it expires", async () => {
    // 2 h 15 min and a bit from now: the countdown shows whole minutes
    const detail = pendingPagoEfectivo(new Date(Date.now() + (135 * 60 + 30) * 1000));
    services.getOlvaShipment.mockResolvedValue(toOlvaShipment(detail));

    const { user } = renderCell(toOlvaShipment(detail));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
    expect(screen.getByText("CIP-123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Link de pago/ })).toHaveAttribute(
      "href",
      "https://pay.test/abc",
    );
    expect(screen.getByRole("img", { name: "QR de pago" })).toHaveAttribute(
      "src",
      "data:image/png;base64,QUJD",
    );
    expect(screen.getByText("Vence en 02:15")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copiar CIP" }));

    expect(writeText).toHaveBeenCalledWith("CIP-123");
  });

  it("reads the payment of a guide's shipment, which the list does not carry", async () => {
    const detail = pendingPagoEfectivo(new Date(Date.now() + 60 * 60 * 1000));
    services.getOlvaShipment.mockResolvedValue(toOlvaShipment(detail));

    renderCell(
      toOlvaShipmentSummary(buildOlvaShipmentListItemResponse({ status: "PENDING_PAYMENT" })),
    );

    expect(await screen.findByText("CIP-123")).toBeInTheDocument();
    expect(services.getOlvaShipment).toHaveBeenCalledWith(ID);
  });

  it("an expired payment: asks for a new one, or discards the shipment after confirming", async () => {
    const expired = toOlvaShipment(buildOlvaShipmentResponse({ status: "PAYMENT_EXPIRED" }));
    services.getOlvaShipment.mockResolvedValue(expired);
    services.regenerateOlvaShipmentPaymentLink.mockResolvedValue(expired);
    services.discardOlvaShipment.mockResolvedValue({ ...expired, status: "DISCARDED" });

    const { user } = renderCell(expired);

    await user.click(screen.getByRole("button", { name: /Generar nuevo pago/ }));
    // TanStack passes extra context after the variable, so only the first argument is compared
    await waitFor(() => expect(services.regenerateOlvaShipmentPaymentLink).toHaveBeenCalled());
    expect(services.regenerateOlvaShipmentPaymentLink.mock.calls[0][0]).toBe(ID);

    await user.click(screen.getByRole("button", { name: "Descartar" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(services.discardOlvaShipment).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Descartar envío" }));

    await waitFor(() => expect(services.discardOlvaShipment).toHaveBeenCalled());
    expect(services.discardOlvaShipment.mock.calls[0][0]).toBe(ID);
    expect(await screen.findByText("Descartado")).toBeInTheDocument();
  });

  it("a registration Olva did not confirm: never register it again, retry it instead", async () => {
    const submitting = toOlvaShipment(
      buildOlvaShipmentResponse({ status: "SUBMITTING", trackingNumber: null, internalId: null }),
    );
    services.retryOlvaShipment.mockResolvedValue({
      status: "created",
      itemKey: "PED-1001",
      shipment: toOlvaShipment(buildOlvaShipmentResponse({ status: "REGISTERED" })),
      label: null,
    });

    const { user } = renderCell(submitting);

    expect(screen.getByText("Registrando")).toBeInTheDocument();
    expect(screen.getByText(/no lo registres de nuevo/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(services.retryOlvaShipment).toHaveBeenCalled());
    expect(services.retryOlvaShipment.mock.calls[0][0]).toEqual({ id: ID });
    // The answer lands in the shipment's cache: the cell shows it without a refetch
    expect(await screen.findByText("Registrado")).toBeInTheDocument();
    expect(services.getOlvaShipment).not.toHaveBeenCalled();
  });

  it("past an hour without Olva's answer, asks to check the guide at Olva and retries confirmed", async () => {
    const submitting = toOlvaShipment(
      buildOlvaShipmentResponse({ status: "SUBMITTING", trackingNumber: null }),
    );
    services.retryOlvaShipment
      .mockRejectedValueOnce(
        buildOlvaAxiosError(409, {
          message: "Manual review",
          details: { code: "SHIPMENT_MANUAL_REVIEW" },
        }),
      )
      .mockResolvedValueOnce({
        status: "unknown",
        itemKey: "PED-1001",
        shipment: submitting,
        error: { code: "OLVA_OUTCOME_UNKNOWN", message: "timeout" },
      });

    const { user } = renderCell(submitting);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Revisa en Olva antes de reintentar")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Ya revisé, reintentar" }));

    await waitFor(() => expect(services.retryOlvaShipment).toHaveBeenCalledTimes(2));
    expect(services.retryOlvaShipment.mock.calls[1][0]).toEqual({ id: ID, confirmed: true });
  });

  it("a failed registration shows the reason Olva gave, with nothing to retry", () => {
    renderCell(
      toOlvaShipmentSummary(
        buildOlvaShipmentListItemResponse({
          status: "FAILED",
          trackingNumber: null,
          failureReason: "Destino sin cobertura",
        }),
      ),
    );

    expect(screen.getByText("Falló")).toBeInTheDocument();
    expect(screen.getByText("Destino sin cobertura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});
