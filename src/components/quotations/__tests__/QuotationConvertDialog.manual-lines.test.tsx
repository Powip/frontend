import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuotationConvertDialog } from "../QuotationDialogs";
import { convertQuotation } from "@/services/quotationService";
import { toast } from "sonner";
import type { Quotation, QuotationLine } from "@/types/quotations";

jest.mock("@/services/quotationService", () => ({ convertQuotation: jest.fn() }));
jest.mock("@/services/leadPaymentsService", () => ({
  getLeadPaymentCapabilities: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const catalogLine: QuotationLine = {
  id: "catalog-line",
  productVariantId: "variant-1",
  name: "Crema",
  quantity: 1,
  unitPrice: 100,
  stockAvailable: 5,
};
const manualLine: QuotationLine = {
  id: "manual-line",
  name: "Producto bajo pedido",
  quantity: 1,
  unitPrice: 20,
  isManual: true,
};
const quote = (lines: QuotationLine[]): Quotation => ({
  id: "quote-1",
  number: "COT-0001",
  publicToken: "public-token",
  publicUrl: "https://www.powip.tech/c/public-token",
  storeId: "store-1",
  customerName: "Ana",
  customerPhone: "999222333",
  status: "PREVENTA",
  paymentType: "ADELANTO",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  lines,
  payments: [
    {
      id: "pay-1",
      amount: 30,
      method: "YAPE_QR",
      status: "PENDIENTE",
      createdAt: new Date().toISOString(),
    },
  ],
  total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  pendingBalance: 90,
  approvedDeposit: 0,
  customerConfirmed: true,
  createdAt: new Date().toISOString(),
});

beforeEach(() => jest.clearAllMocks());

it.each([
  ["manual", [manualLine]],
  ["mixed", [catalogLine, manualLine]],
  ["unlinked", [{ ...manualLine, isManual: false }]],
] as const)("recovers an interrupted %s conversion through the server without changing the snapshot", async (_scenario, lines) => {
  const quotation = quote(lines.map((line) => ({
    ...line,
    stockInsufficient: _scenario === "mixed" && Boolean(line.productVariantId),
  })));
  const before = JSON.stringify(quotation);
  const onSaved = jest.fn();
  const recovered = {
    ...quotation,
    status: "CONVERTIDA" as const,
    orderId: "durable-order",
    orderNumber: "ORD-123456",
  };
  jest.mocked(convertQuotation).mockResolvedValue(recovered);
  render(
    <QuotationConvertDialog
      quotation={quotation}
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Reemplaza las líneas manuales o sin vincular por productos del catálogo",
  );
  expect(screen.getByText(/Esta acción sólo recupera una venta ya registrada/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar y crear venta" })).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Recuperar venta existente" });
  expect(button).toBeEnabled();
  for (const [label, value] of [
    ["Dirección de entrega *", "Av. Lima 123"],
    ["Departamento *", "Lima"],
    ["Provincia *", "Lima"],
    ["Distrito *", "Breña"],
    ["Moneda (PEN, USD…) *", "PEN"],
    ["Canal de venta", "WHATSAPP"],
    ["Canal de cierre", "LLAMADA"],
    ["Tipo de pago", "CONTRAENTREGA"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(button);
  await waitFor(() => expect(convertQuotation).toHaveBeenCalledWith(
    quotation.id,
    expect.objectContaining({ address: "Av. Lima 123", district: "Breña", currency: "PEN" }),
  ));
  expect(onSaved).toHaveBeenCalledWith(recovered);
  expect(toast.success).toHaveBeenCalledWith("Venta ORD-123456 recuperada.");
  expect(JSON.stringify(quotation)).toBe(before);
});
