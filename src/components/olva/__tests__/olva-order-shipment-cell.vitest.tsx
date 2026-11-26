import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaShipmentSummary } from "@/features/olva/olva-shipment/mappers/to-olva-shipment-summary";
import { buildOlvaShipmentListItemResponse } from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";
import { OlvaOrderShipmentCell } from "../OlvaOrderShipmentCell";

const { getOlvaShipments } = vi.hoisted(() => ({ getOlvaShipments: vi.fn() }));

vi.mock("@/features/olva/olva-shipment/services/olva-shipment.service", () => ({
  getOlvaShipments,
  getOlvaShipment: vi.fn(),
}));

function renderCells() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <div data-testid="order-a">
        <OlvaOrderShipmentCell guideId="g-1" orderId="A" />
      </div>
      <div data-testid="order-b">
        <OlvaOrderShipmentCell guideId="g-1" orderId="B" />
      </div>
    </QueryClientProvider>,
  );
}

describe("OlvaOrderShipmentCell", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks once for the guide's shipments and shows each order its own", async () => {
    getOlvaShipments.mockResolvedValue({
      items: [
        toOlvaShipmentSummary(
          buildOlvaShipmentListItemResponse({
            id: "s-a",
            status: "IN_TRANSIT",
            externalRef: { orderId: "A", guideId: "g-1" },
          }),
        ),
      ],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    });

    renderCells();

    expect(await screen.findByText("En tránsito")).toBeInTheDocument();
    expect(screen.getByTestId("order-b")).toBeEmptyDOMElement();
    expect(getOlvaShipments).toHaveBeenCalledTimes(1);
    expect(getOlvaShipments.mock.calls[0][0]).toMatchObject({ guideId: "g-1" });
  });
});
