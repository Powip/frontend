import { fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import LiveOrderTracking from "../LiveOrderTracking";

/** FEAT-33 L4c: la página del pedido del mockup, con la apariencia del catálogo de la tienda. */
jest.mock("axios", () => {
  const instance = { get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { ...instance, create: () => instance, isAxiosError: () => false } };
});
jest.mock("../LiveManualPaymentDialog", () => ({
  __esModule: true,
  default: ({ checkoutId }: { checkoutId: string }) => <div data-testid="pay-dialog">{checkoutId}</div>,
}));

const tracking = (patch: Record<string, unknown> = {}) => ({
  storeId: "store-1",
  orderNumber: "ORD-153866",
  status: "PENDIENTE",
  buyerStatus: "UNDER_REVIEW",
  origin: "POWIP_LIVE",
  businessName: "Kunca SAC",
  businessPhone: "987654321",
  customer: { fullName: "Rosa Quispe" },
  items: [
    { productName: "Polo básico", quantity: 2, unitPrice: 30, subtotal: 60, attributes: { Talla: "M" } },
  ],
  totals: { grandTotal: 70, totalPaid: 0, pendingAmount: 70 },
  paymentReviewAmount: 70,
  timeline: [
    { step: "RECEIVED", label: "Pedido recibido", completed: true, current: false },
    { step: "PAYMENT", label: "Pago", completed: false, current: true },
    { step: "PREPARADO", label: "En Preparación", completed: false, current: false },
    { step: "ENTREGADO", label: "Entregado", completed: false, current: false },
  ],
  payments: [
    { checkoutId: "c-1", amount: 70, status: "UNDER_REVIEW", reason: null, operationNumber: "01234567" },
  ],
  delivery: { agency: "Baños del Inca", district: "Los Baños Del Inca", province: "Cajamarca", department: "Cajamarca" },
  appearance: {
    theme: "light",
    color: "#f37ea3",
    displayName: "Kunca Store",
    logoUrl: "https://storage.test/logo.png",
  },
  ...patch,
});
const show = async (patch: Record<string, unknown> = {}) => {
  (axios.get as jest.Mock).mockResolvedValue({ data: tracking(patch) });
  const view = render(<LiveOrderTracking token={"A".repeat(43)} />);
  await screen.findByText("ORD-153866");
  return view;
};

test("uses the store look: theme, color, logo and name", async () => {
  await show();
  const page = screen.getByTestId("live-order");
  expect(page).toHaveAttribute("data-theme", "light");
  expect(page.style.getPropertyValue("--acc")).toBe("#f37ea3");
  expect(document.body.style.getPropertyValue("--acc")).toBe("#f37ea3");
  const top = within(screen.getByRole("banner"));
  expect(top.getByRole("img", { name: "Logo de Kunca Store" })).toHaveAttribute(
    "src",
    "https://storage.test/logo.png",
  );
  expect(top.getByText("Kunca Store")).toBeInTheDocument();
  expect(top.getByText("Validando tu pago")).toBeInTheDocument();
});

test("under review: explains the validation with the operation number", async () => {
  await show();
  expect(screen.getByRole("heading", { name: "Recibimos tu comprobante" })).toBeInTheDocument();
  expect(screen.getByText(/está validando tu Yape/)).toHaveTextContent(
    "Kunca Store está validando tu Yape (op. 01234567). Te avisamos por WhatsApp apenas se confirme. Tus productos siguen separados.",
  );
});

test("the follow-up steps mark what is done and what is next", async () => {
  await show();
  const steps = within(screen.getByRole("list", { name: "Seguimiento del pedido" }));
  expect(steps.getByText("Pedido recibido").closest("li")).toHaveTextContent("✓");
  expect(steps.getByText("Desde el catálogo del live")).toBeInTheDocument();
  const pay = steps.getByText("Pago con Yape").closest("li");
  expect(pay).toHaveAttribute("aria-current", "step");
  expect(pay).toHaveTextContent("En validación");
  expect(steps.getByText("En preparación")).toBeInTheDocument();
});

test("lists what was bought, the shipping and the total, and the delivery", async () => {
  await show();
  const order = within(screen.getByRole("region", { name: "Tu pedido" }));
  expect(order.getByText("2 × Polo básico")).toBeInTheDocument();
  expect(order.getByText("M")).toBeInTheDocument();
  expect(order.getByText(/Envío/).parentElement).toHaveTextContent(/S\/\s10\.00/);
  expect(order.getByText("Total").parentElement).toHaveTextContent(/S\/\s70\.00/);
  const delivery = within(screen.getByRole("region", { name: "Entrega" }));
  expect(delivery.getByText(/Rosa Quispe · Baños del Inca/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Escribir a la tienda/ })).toHaveAttribute(
    "href",
    "https://wa.me/51987654321",
  );
});

test("rejected: shows the reason and lets the buyer send another proof", async () => {
  await show({
    buyerStatus: "REJECTED",
    payments: [
      { checkoutId: "c-9", amount: 70, status: "REJECTED", reason: "No encontramos el ingreso", operationNumber: "1111" },
    ],
  });
  expect(screen.getByRole("heading", { name: "No pudimos validar tu pago" })).toBeInTheDocument();
  expect(screen.getByText(/Motivo:/)).toHaveTextContent("Motivo: No encontramos el ingreso.");
  fireEvent.click(screen.getAllByRole("button", { name: "Enviar otro comprobante" })[0]);
  expect(screen.getByTestId("pay-dialog")).toHaveTextContent("c-9");
});

test("approved and cancelled orders say so", async () => {
  const { unmount } = await show({ buyerStatus: "APPROVED" });
  expect(screen.getByRole("heading", { name: "¡Pago confirmado! 🎉" })).toBeInTheDocument();
  unmount();
  await show({ buyerStatus: "CANCELLED", status: "ANULADO" });
  expect(screen.getByRole("heading", { name: "Este pedido ya no está disponible" })).toBeInTheDocument();
});

test("without a saved appearance it uses the default look and the business name", async () => {
  await show({ appearance: null });
  expect(screen.getByTestId("live-order")).toHaveAttribute("data-theme", "dark");
  expect(within(screen.getByRole("banner")).getByText("Kunca SAC")).toBeInTheDocument();
  expect(within(screen.getByRole("banner")).getByText("KS")).toBeInTheDocument();
});
