import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuotationForm from "@/components/quotations/QuotationForm";
import {
  QuotationConvertDialog,
  QuotationDetailDialog,
  QuotationPaymentDialog,
} from "@/components/quotations/QuotationDialogs";
import {
  convertQuotation,
  createQuotation,
  getQuotationCatalog,
  getQuotationInventories,
  registerQuotationPayment,
  uploadQuotationProof,
  reconcileQuotationLeadPayment,
  reviewQuotationPayment,
} from "@/services/quotationService";
import type { Quotation } from "@/types/quotations";

jest.mock("@/services/quotationService", () => ({
  createQuotation: jest.fn(),
  updateQuotation: jest.fn(),
  getQuotationCatalog: jest.fn(),
  getQuotationInventories: jest.fn(),
  searchQuotationCustomers: jest.fn(),
  uploadQuotationLineImage: jest.fn(),
  convertQuotation: jest.fn(),
  registerQuotationPayment: jest.fn(),
  reviewQuotationPayment: jest.fn(),
  uploadQuotationProof: jest.fn(),
  reconcileQuotationLeadPayment: jest.fn(),
}));
jest.mock("@/services/leadPaymentsService", () => ({
  getLeadPaymentCapabilities: jest.fn(),
}));
import { getLeadPaymentCapabilities } from "@/services/leadPaymentsService";
jest.mock("@/contexts/PacksContext", () => ({
  usePacks: () => ({ packs: [] }),
}));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
const quotation: Quotation = {
  id: "quote-1",
  number: "COT-0001",
  storeId: "store-1",
  customerName: "María Quispe",
  customerPhone: "987 654 321",
  status: "PREVENTA",
  paymentType: "ADELANTO",
  suggestedDeposit: 30,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  lines: [
    {
      id: "line-1",
      productVariantId: "variant-1",
      name: "Crema",
      quantity: 1,
      unitPrice: 100,
      stockAvailable: 8,
    },
  ],
  payments: [
    {
      id: "payment-1",
      amount: 30,
      method: "YAPE_QR",
      status: "PENDIENTE",
      createdAt: new Date().toISOString(),
    },
  ],
  total: 100,
  pendingBalance: 70,
  approvedDeposit: 0,
  depositAmount: 30,
  publicToken: "token",
  publicUrl: "http://localhost:3000/c/token",
  customerConfirmed: false,
  createdAt: new Date().toISOString(),
};
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => `line-${Math.random()}`),
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getLeadPaymentCapabilities).mockResolvedValue({
    enabled: true,
    canView: true,
    canCapture: true,
    canReview: true,
  });
  jest.mocked(getQuotationInventories).mockResolvedValue([{ id: "inventory-1", name: "Principal", isActive: true }]);
  (getQuotationCatalog as jest.Mock).mockResolvedValue([
    {
      productVariantId: "variant-1",
      name: "Crema",
      sku: "CREMA",
      unitPrice: 100,
      stockAvailable: 3,
    },
    {
      productVariantId: "variant-2",
      name: "Sérum agotado",
      sku: "SERUM",
      unitPrice: 40,
      stockAvailable: 0,
    },
  ]);
  (createQuotation as jest.Mock).mockResolvedValue(quotation);
  (convertQuotation as jest.Mock).mockResolvedValue({
    ...quotation,
    status: "CONVERTIDA",
    orderNumber: "ORD-123",
  });
  (registerQuotationPayment as jest.Mock).mockResolvedValue(quotation);
});

test("reconciles the selected advance explicitly without approving quotation JSON or reviving an older payment", async () => {
  const onUpdated = jest.fn();
  jest.mocked(reconcileQuotationLeadPayment).mockResolvedValue({
    leadId: "lead-quote",
    id: "canonical",
    currency: "PEN",
    amount: 30,
    status: "PAID",
    leadPaymentVersion: 1,
  });
  const detailProps = {
    canReviewPayments: true,
    onClose: jest.fn(),
    onUpdated,
    onEdit: jest.fn(),
    onConvert: jest.fn(),
    onShare: jest.fn(),
    onPayment: jest.fn(),
  };
  const { rerender } = render(
    <QuotationDetailDialog
      quotation={{
        ...quotation,
        payments: [{ ...quotation.payments[0], status: "APROBADO" }],
      }}
      {...detailProps}
    />,
  );
  const reconcile = await screen.findByRole("button", {
    name: "Vincular anticipo al Lead",
  });
  expect(reconcile).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Moneda del anticipo"), {
    target: { value: "PEN" },
  });
  expect(reconcile).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Confirmo la evidencia/ }),
  );
  fireEvent.click(reconcile);
  await waitFor(() =>
    expect(reconcileQuotationLeadPayment).toHaveBeenCalledWith(
      "quote-1",
      "payment-1",
      { currency: "PEN", confirmApproved: true },
    ),
  );
  expect(reviewQuotationPayment).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("link", {
      name: "Gestionar el anticipo en el Lead",
    }),
  ).toHaveAttribute("href", "/leads-comerciales?leadId=lead-quote");
  rerender(
    <QuotationDetailDialog
      quotation={{
        ...quotation,
        payments: [
          { ...quotation.payments[0], status: "APROBADO" },
          {
            ...quotation.payments[0],
            id: "rejected-latest",
            status: "RECHAZADO",
          },
        ],
      }}
      {...detailProps}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Vincular anticipo al Lead" }),
  ).not.toBeInTheDocument();
});

test("creates a quick quotation and preserves the seller's suggested deposit after quantities change", async () => {
  const onSaved = jest.fn();
  render(
    <QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={onSaved} />,
  );
  fireEvent.change(screen.getByLabelText("Nombre completo *"), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono *"), {
    target: { value: "999 222 333" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /^Crema/ }, { timeout: 10000 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Con adelanto (COD)" }));
  expect(screen.getByLabelText("Adelanto sugerido (S/) *")).toHaveValue(30);
  fireEvent.change(screen.getByLabelText("Adelanto sugerido (S/) *"), {
    target: { value: "45" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad"), {
    target: { value: "2" },
  });
  expect(screen.getByLabelText("Adelanto sugerido (S/) *")).toHaveValue(45);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "Ana",
        customerPhone: "999 222 333",
        storeId: "store-1",
        paymentType: "ADELANTO",
        suggestedDeposit: 45,
        validityHours: 24,
        lines: [
          expect.objectContaining({
            productVariantId: "variant-1",
            quantity: 2,
            unitPrice: 100,
            isManual: false,
          }),
        ],
      }),
    ),
  );
  expect(onSaved).toHaveBeenCalledWith(quotation);
});

test("blocks exhausted catalog items and overstock quantities but supports manual lines", async () => {
  render(
    <QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("Nombre completo *"), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono *"), {
    target: { value: "999222333" },
  });
  expect(
    await screen.findByRole("button", { name: /Sérum agotado/ }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /^Crema/ }));
  fireEvent.change(screen.getByLabelText("Cantidad"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  expect(createQuotation).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Hay productos sin stock suficiente/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Quitar Crema" }));
  fireEvent.click(screen.getByRole("button", { name: "Otro producto" }));
  fireEvent.change(screen.getByLabelText("Nombre línea manual 1"), {
    target: { value: "Producto bajo pedido" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            name: "Producto bajo pedido",
            isManual: true,
            productVariantId: undefined,
          }),
        ],
      }),
    ),
  );
});

test("rejects a past custom expiry before posting", async () => {
  render(
    <QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("Nombre completo *"), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Teléfono *"), {
    target: { value: "999222333" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /^Crema/ }, { timeout: 10000 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Otra fecha" }));
  fireEvent.change(screen.getByLabelText("Fecha y hora de vigencia"), {
    target: { value: "2020-01-01T10:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "La fecha de vigencia debe ser posterior a ahora.",
  );
  expect(createQuotation).not.toHaveBeenCalled();
});

test("conversion requires dispatch details and deducts pending deposit with shipping", async () => {
  const onSaved = jest.fn();
  render(
    <QuotationConvertDialog
      quotation={quotation}
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar y crear venta" }),
  );
  expect(convertQuotation).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Completa dirección y distrito",
  );
  fireEvent.change(screen.getByLabelText("Dirección de entrega *"), {
    target: { value: "Av. Lima 123" },
  });
  fireEvent.change(screen.getByLabelText("Departamento *"), {
    target: { value: "Lima" },
  });
  fireEvent.change(screen.getByLabelText("Provincia *"), {
    target: { value: "Lima" },
  });
  fireEvent.change(screen.getByLabelText("Distrito *"), {
    target: { value: "Breña" },
  });
  fireEvent.change(screen.getByLabelText("Moneda (PEN, USD…) *"), {
    target: { value: "PEN" },
  });
  fireEvent.change(screen.getByLabelText("Costo de envío (S/)"), {
    target: { value: "10" },
  });
  expect(screen.getByLabelText("Canal de venta")).toHaveValue("");
  expect(screen.getByLabelText("Tipo de pago")).toHaveValue("");
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar y crear venta" }),
  );
  expect(convertQuotation).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Canal de venta"), {
    target: { value: "WHATSAPP" },
  });
  fireEvent.change(screen.getByLabelText("Canal de cierre"), {
    target: { value: "LLAMADA" },
  });
  fireEvent.change(screen.getByLabelText("Tipo de pago"), {
    target: { value: "CONTRAENTREGA" },
  });
  expect(screen.getByText("S/80.00")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar y crear venta" }),
  );
  await waitFor(() =>
    expect(convertQuotation).toHaveBeenCalledWith(
      "quote-1",
      expect.objectContaining({
        address: "Av. Lima 123",
        district: "Breña",
        shippingTotal: 10,
        deliveryType: "DOMICILIO",
      }),
    ),
  );
  expect(onSaved).toHaveBeenCalled();
});

test("registers overpayments pending review and rejects invalid evidence", async () => {
  render(
    <QuotationPaymentDialog
      quotation={quotation}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Monto del adelanto (S/) *"), {
    target: { value: "150" },
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "El adelanto supera el total",
  );
  const fileInput = screen.getByLabelText("Comprobante (opcional)");
  fireEvent.change(fileInput, {
    target: {
      files: [
        new File(["bad"], "bad.exe", { type: "application/octet-stream" }),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar adelanto" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Adjunta un JPG, PNG o PDF",
  );
  expect(uploadQuotationProof).not.toHaveBeenCalled();
  fireEvent.change(fileInput, { target: { files: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar adelanto" }));
  await waitFor(() =>
    expect(registerQuotationPayment).toHaveBeenCalledWith("quote-1", {
      amount: 150,
      method: "YAPE_QR",
      proofUrl: undefined,
    }),
  );
});
