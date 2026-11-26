import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaTracking } from "@/features/olva/olva-tracking/mappers/to-olva-tracking";
import { buildTrackOlvaShipmentResponse } from "@/features/olva/olva-tracking/test-utils/olva-tracking.fixtures";
import type { OrderHeader } from "@/interfaces/IOrder";
import OlvaOrderTrackingView from "../OlvaOrderTrackingView";

const { trackOlvaShipmentsBatch } = vi.hoisted(() => ({ trackOlvaShipmentsBatch: vi.fn() }));

vi.mock("@/features/olva/olva-tracking/services/olva-tracking.service", () => ({
  trackOlvaShipmentsBatch,
}));

const order = (orderNumber: string, overrides: Partial<OrderHeader> = {}) =>
  ({
    id: `id-${orderNumber}`,
    orderNumber,
    courier: "Olva Courier",
    olvaShipmentId: `shipment-${orderNumber}`,
    olvaStatus: "IN_TRANSIT",
    externalTrackingNumber: null,
    ...overrides,
  }) as OrderHeader;

function renderView(orders: OrderHeader[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup({ delay: null });
  const view = render(
    <QueryClientProvider client={client}>
      <OlvaOrderTrackingView orders={orders} />
    </QueryClientProvider>,
  );
  return { ...view, user };
}

const rowOf = (orderNumber: string) => screen.getByRole("row", { name: new RegExp(orderNumber) });

describe("OlvaOrderTrackingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no dibuja nada si ningún pedido se registró en Olva desde Powip", () => {
    const { container } = renderView([order("PED-1", { olvaShipmentId: null, olvaStatus: null })]);

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el estado guardado de cada envío, sin consultar a Olva al abrir", () => {
    renderView([
      order("PED-1", { externalTrackingNumber: "1234567-26" }),
      order("PED-2", { olvaStatus: "SUBMITTING" }),
      order("PED-MANUAL", { olvaShipmentId: null, olvaStatus: null }),
    ]);

    expect(within(rowOf("PED-1")).getByText("1234567-26")).toBeInTheDocument();
    expect(within(rowOf("PED-1")).getByText("En tránsito")).toBeInTheDocument();
    expect(within(rowOf("PED-2")).getByText("Registrando")).toBeInTheDocument();
    expect(screen.queryByText("PED-MANUAL")).not.toBeInTheDocument();
    expect(trackOlvaShipmentsBatch).not.toHaveBeenCalled();
  });

  it("«Actualizar» consulta a Olva solo las guías que todavía pueden cambiar y muestra lo que responde", async () => {
    trackOlvaShipmentsBatch.mockResolvedValue([
      {
        success: true,
        orderNumber: "1234567",
        orderCode: "26",
        tracking: toOlvaTracking(
          buildTrackOlvaShipmentResponse({
            trackingNumber: "1234567-26",
            status: "OUT_FOR_DELIVERY",
            statusDetail: "Salió a reparto",
          }),
        ),
      },
      { success: false, orderNumber: "7654321", orderCode: "26", error: "Guía no encontrada" },
    ]);
    const { user } = renderView([
      order("PED-1", { externalTrackingNumber: "1234567-26" }),
      order("PED-2", { externalTrackingNumber: "7654321-26" }),
      order("PED-ENTREGADO", { externalTrackingNumber: "1111111-26", olvaStatus: "DELIVERED" }),
      order("PED-SIN-GUIA", { olvaStatus: "SUBMITTING" }),
    ]);

    await user.click(screen.getByRole("button", { name: /Actualizar/ }));

    await waitFor(() => expect(trackOlvaShipmentsBatch).toHaveBeenCalledOnce());
    expect(trackOlvaShipmentsBatch.mock.calls[0][0]).toEqual([
      { orderNumber: "1234567", orderCode: "26" },
      { orderNumber: "7654321", orderCode: "26" },
    ]);
    expect(await within(rowOf("PED-1")).findByText("En reparto")).toBeInTheDocument();
    expect(within(rowOf("PED-1")).getByText("Salió a reparto")).toBeInTheDocument();
    expect(within(rowOf("PED-2")).getByText("Guía no encontrada")).toBeInTheDocument();
  });

  it("más de 50 guías van en tandas de 50 (el máximo de Olva por consulta)", async () => {
    trackOlvaShipmentsBatch.mockResolvedValue([]);
    const orders = Array.from({ length: 51 }, (_, i) =>
      order(`PED-${i}`, { externalTrackingNumber: `${1000000 + i}-26` }),
    );
    const { user } = renderView(orders);

    await user.click(screen.getByRole("button", { name: /Actualizar/ }));

    await waitFor(() => expect(trackOlvaShipmentsBatch).toHaveBeenCalledTimes(2));
    expect(trackOlvaShipmentsBatch.mock.calls[0][0]).toHaveLength(50);
    expect(trackOlvaShipmentsBatch.mock.calls[1][0]).toHaveLength(1);
  });

  it("sin guías que consultar el botón queda deshabilitado", () => {
    renderView([order("PED-1", { olvaStatus: "SUBMITTING" })]);

    expect(screen.getByRole("button", { name: /Actualizar/ })).toBeDisabled();
  });
});
