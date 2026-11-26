import { render, screen } from "@testing-library/react";
import axios from "axios";
import LiveOrderTracking from "../LiveOrderTracking";

// FEAT-33 A12: la página del pedido dice por dónde entró la compra (antes decía siempre «POWIP Link»).
jest.mock("axios", () => {
  const instance = { get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { ...instance, create: () => instance, isAxiosError: () => false } };
});
jest.mock("../LiveManualPaymentDialog", () => ({ __esModule: true, default: () => null }));

const tracking = (origin?: string) => ({
  storeId: "store-1",
  orderNumber: "ORD-153866",
  status: "PENDIENTE",
  buyerStatus: "UNDER_REVIEW",
  businessName: "Kunca",
  customer: { fullName: "Rosa" },
  items: [],
  totals: { grandTotal: 199, totalPaid: 0, pendingAmount: 199 },
  paymentReviewAmount: 199,
  timeline: [],
  payments: [],
  ...(origin ? { origin } : {}),
});

test.each([
  ["POWIP_LIVE", "POWIP Live"],
  ["POWIP_LINK", "POWIP Link"],
  [undefined, "POWIP"],
])("origin %p → %s", async (origin, label) => {
  (axios.get as jest.Mock).mockResolvedValue({ data: tracking(origin) });
  render(<LiveOrderTracking token={"A".repeat(43)} />);
  await screen.findByText("ORD-153866");
  expect(screen.getByTestId("pedido-origen")).toHaveTextContent(new RegExp(`^${label}$`));
});

test("the order page gives its Yape dialog the catalog colors (FEAT-33 B5)", async () => {
  (axios.get as jest.Mock).mockResolvedValue({ data: tracking("POWIP_LIVE") });
  const { unmount } = render(<LiveOrderTracking token={"A".repeat(43)} />);
  await screen.findByText("ORD-153866");
  expect(document.body.style.getPropertyValue("--b-bg")).toBe("#0b0d11");
  expect(document.body.style.getPropertyValue("--acc")).toBe("#72efe8");
  unmount();
  expect(document.body.style.getPropertyValue("--acc")).toBe("");
});

test("the order page marks the gift of a Live promo (FEAT-33 L7b)", async () => {
  (axios.get as jest.Mock).mockResolvedValue({
    data: {
      ...tracking("POWIP_LIVE"),
      items: [
        { productName: "Polo", quantity: 2, unitPrice: 25, subtotal: 30 },
        { productName: "Medias", quantity: 1, unitPrice: 0, subtotal: 0, isGift: true },
      ],
    },
  });
  render(<LiveOrderTracking token={"A".repeat(43)} />);
  await screen.findByText("ORD-153866");
  expect(screen.getByText("1 × Medias").parentElement).toHaveTextContent("🎁 Regalo");
  expect(screen.getByText("2 × Polo").parentElement).not.toHaveTextContent("Regalo");
});
