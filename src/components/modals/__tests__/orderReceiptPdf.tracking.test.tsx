import { render, screen } from "@testing-library/react";
import OrderReceiptPdf from "../orderReceiptPdf";
import type { OrderReceipt } from "@/utils/printOrderLabel";
const receipt = (): OrderReceipt => ({
  orderId: "order",
  orderNumber: "NV1",
  status: "ENTREGADO",
  createdAt: "2026-10-17T10:00:00Z",
  unitAssignmentStatus: "CONFIRMED",
  unitCatalogValidated: true,
  stockVersion: 3,
  confirmedStockVersion: 3,
  customer: { fullName: "Cliente" },
  items: [
    {
      productName: "Celular",
      quantity: 1,
      unitPrice: 25,
      subtotal: 25,
      discountAmount: 0,
      trackingMode: "IMEI",
      unitIds: ["00000000-0000-4000-8000-000000000001"],
      units: [
        { id: "00000000-0000-4000-8000-000000000001", code: "001234567890123", status: "SOLD" },
      ],
    },
  ],
  payments: [],
  totals: {
    productsTotal: 25,
    taxTotal: 0,
    shippingTotal: 0,
    discountTotal: 0,
    grandTotal: 25,
    totalPaid: 0,
    pendingAmount: 25,
  },
});
test("prints confirmed codes as complete separate rows beneath their product", () => {
  render(<OrderReceiptPdf data={receipt()} />);
  const row = screen.getByText("IMEI: 001234567890123").closest("tr")!;
  expect(row.previousElementSibling).toHaveTextContent("Celular");
  expect(row.querySelector("td")).toHaveAttribute("colspan", "4");
  expect(row.querySelector("td")).toHaveStyle({ overflowWrap: "anywhere", whiteSpace: "normal" });
});
test("prints a notice instead of unconfirmed codes", () => {
  const data = receipt();
  data.unitAssignmentStatus = "PENDING";
  render(<OrderReceiptPdf data={data} />);
  expect(screen.getByText("Códigos pendientes de confirmación.")).toBeInTheDocument();
  expect(screen.queryByText(/001234567890123/)).not.toBeInTheDocument();
});
test("quantity-only receipts retain ordinary product rows without a codes section", () => {
  const data = receipt();
  data.items[0].trackingMode = "NONE";
  render(<OrderReceiptPdf data={data} />);
  expect(screen.getByText("Celular")).toBeInTheDocument();
  expect(screen.queryByText(/IMEI|Serie|Códigos/)).not.toBeInTheDocument();
});
