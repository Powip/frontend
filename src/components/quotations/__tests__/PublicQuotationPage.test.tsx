import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicQuotationPage from "../PublicQuotationPage";
import * as service from "@/services/quotationService";
import type { PublicQuotation, QuotationCatalogItem, QuotationPayment } from "@/types/quotations";

jest.mock("@/services/quotationService", () => ({
  ...jest.requireActual("@/services/quotationService"),
  getPublicQuotation: jest.fn(),
  getPublicQuotationCatalog: jest.fn(),
  confirmPublicQuotation: jest.fn(),
  savePublicQuotationAddress: jest.fn(),
  registerPublicQuotationPayment: jest.fn(),
  addPublicQuotationLine: jest.fn(),
  removePublicQuotationLine: jest.fn(),
  uploadPublicQuotationProof: jest.fn(),
}));

jest.setTimeout(30_000);
configure({ asyncUtilTimeout: 10_000 });

const api = jest.mocked(service);
const payment = (overrides: Partial<QuotationPayment> = {}): QuotationPayment => ({
  id: "payment-1", amount: 100, method: "YAPE_QR", status: "PENDIENTE",
  createdAt: "2026-10-16T12:00:00.000Z", ...overrides,
});

const quotation = (overrides: Partial<PublicQuotation> = {}): PublicQuotation => ({
  number: "COT-0001", customerName: "María Quispe", status: "PREVENTA",
  paymentType: "COMPLETO", expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  lines: [{ id: "line-1", productVariantId: "variant-1", name: "Sérum", quantity: 1, unitPrice: 100, stockAvailable: 5 }],
  payments: [], total: 100, pendingBalance: 100, approvedDeposit: 0,
  customerConfirmed: false, sellerPhone: "987654321", ...overrides,
});

describe("PublicQuotationPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.getPublicQuotation.mockResolvedValue(quotation());
    api.getPublicQuotationCatalog.mockResolvedValue([]);
  });

  it("requires full payment and never offers free confirmation for COMPLETO", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PublicQuotationPage token="public-token" />);

    await user.click(await screen.findByRole("button", { name: "Pagar S/100.00 ahora" }));
    expect(screen.queryByRole("button", { name: "Confirmar pedido" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Monto pagado (S/)")).toHaveValue(100);

    fireEvent.change(screen.getByLabelText("Monto pagado (S/)"), { target: { value: "50" } });
    await user.click(screen.getByRole("button", { name: "Ya pagué, avisar al vendedor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pago completo de S/100.00");
    expect(api.registerPublicQuotationPayment).not.toHaveBeenCalled();
    expect(api.confirmPublicQuotation).not.toHaveBeenCalled();
  });

  it("reports a full payment and proof as pending without claiming approval", async () => {
    const user = userEvent.setup({ delay: null });
    api.uploadPublicQuotationProof.mockResolvedValue("https://proof.example/receipt.pdf");
    api.registerPublicQuotationPayment.mockResolvedValue(quotation({
      payments: [payment()], depositAmount: 100, pendingBalance: 0, customerConfirmed: true,
    }));
    render(<PublicQuotationPage token="public-token" />);

    await user.click(await screen.findByRole("button", { name: "Pagar S/100.00 ahora" }));
    const file = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Comprobante/), file);
    await user.click(screen.getByRole("button", { name: "Ya pagué, avisar al vendedor" }));

    await waitFor(() => expect(api.registerPublicQuotationPayment).toHaveBeenCalledWith("public-token", {
      amount: 100, method: "YAPE_QR", proofUrl: "https://proof.example/receipt.pdf",
    }));
    expect(api.uploadPublicQuotationProof).toHaveBeenCalledWith("public-token", file);
    expect(await screen.findByText("Pago por verificar: S/100.00")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("antes de aprobarlo");
    expect(screen.getByRole("heading", { name: "Pedido confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dirección de entrega" })).toBeInTheDocument();
    expect(screen.queryByText("Pedido pagado en su totalidad")).not.toBeInTheDocument();
  });

  it("reflects approval on refresh and ignores superseded pending payment history", async () => {
    const user = userEvent.setup({ delay: null });
    api.getPublicQuotation
      .mockResolvedValueOnce(quotation({ payments: [payment()], pendingBalance: 0 }))
      .mockResolvedValueOnce(quotation({
        payments: [payment(), payment({ id: "payment-2", status: "APROBADO" })],
        customerConfirmed: true, approvedDeposit: 100, pendingBalance: 0,
      }));
    render(<PublicQuotationPage token="public-token" />);
    expect(await screen.findByText("Pago por verificar: S/100.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actualizar cotización" }));

    expect(await screen.findByRole("heading", { name: "Pedido confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dirección de entrega" })).toBeInTheDocument();
    expect(screen.queryByText(/Pago por verificar/)).not.toBeInTheDocument();
  });

  it("lets COD customers confirm for free and save their delivery details", async () => {
    const user = userEvent.setup({ delay: null });
    const quote = quotation({ paymentType: "ADELANTO", suggestedDeposit: 30 });
    api.getPublicQuotation.mockResolvedValue(quote);
    api.confirmPublicQuotation.mockResolvedValue({ ...quote, customerConfirmed: true });
    api.savePublicQuotationAddress.mockResolvedValue({
      ...quote, customerConfirmed: true, address: { address: "Jr. Unión 123", district: "Breña" },
    });
    render(<PublicQuotationPage token="cod-token" />);

    await user.click(await screen.findByRole("button", { name: "Confirmar pedido" }));
    expect(api.confirmPublicQuotation).toHaveBeenCalledWith("cod-token");
    expect(api.registerPublicQuotationPayment).not.toHaveBeenCalled();
    const save = await screen.findByRole("button", { name: "Guardar dirección" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Dirección completa"), "  Jr. Unión 123  ");
    await user.type(screen.getByLabelText("Distrito"), "  Breña  ");
    await user.click(save);

    await waitFor(() => expect(api.savePublicQuotationAddress).toHaveBeenCalledWith("cod-token", {
      address: "Jr. Unión 123", district: "Breña",
    }));
    expect(screen.getByRole("status")).toHaveTextContent("Dirección guardada");
  });

  it("offers only seller contact when the quotation has expired locally", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      paymentType: "ADELANTO", expiresAt: new Date(Date.now() - 60_000).toISOString(),
    }));
    render(<PublicQuotationPage token="expired-token" />);

    expect(await screen.findByRole("heading", { name: "Tu cotización ha vencido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir cotización nueva" })).toHaveAttribute("href", expect.stringContaining("wa.me/51987654321"));
    expect(screen.queryByRole("button", { name: /Confirmar pedido|Pagar|Agregar más productos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reportar un pago" })).not.toBeInTheDocument();
    expect(api.confirmPublicQuotation).not.toHaveBeenCalled();
    expect(api.registerPublicQuotationPayment).not.toHaveBeenCalled();
  });

  it("lets a confirmed COD customer report the first advance later", async () => {
    const user = userEvent.setup({ delay: null });
    const quote = quotation({ paymentType: "ADELANTO", suggestedDeposit: 30, customerConfirmed: true });
    api.getPublicQuotation.mockResolvedValue(quote);
    api.registerPublicQuotationPayment.mockResolvedValue({
      ...quote, payments: [payment({ amount: 30 })], pendingBalance: 70,
    });
    render(<PublicQuotationPage token="confirmed-cod-token" />);

    await user.click(await screen.findByRole("button", { name: "Pagar adelanto de S/30.00" }));
    expect(screen.getByLabelText("Monto pagado (S/)")).toHaveValue(30);
    await user.click(screen.getByRole("button", { name: "Ya pagué, avisar al vendedor" }));

    await waitFor(() => expect(api.registerPublicQuotationPayment).toHaveBeenCalledWith("confirmed-cod-token", {
      amount: 30, method: "YAPE_QR", proofUrl: undefined,
    }));
    expect(await screen.findByText("Pago por verificar: S/30.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar adelanto de S/30.00" })).not.toBeInTheDocument();
    expect(api.confirmPublicQuotation).not.toHaveBeenCalled();
  });

  it("blocks confirmation until an insufficient-stock line is removed", async () => {
    const user = userEvent.setup({ delay: null });
    const quote = quotation({ paymentType: "ADELANTO", lines: [
      { id: "empty-line", productVariantId: "empty-variant", name: "Crema agotada", quantity: 2, unitPrice: 50, stockInsufficient: true, stockAvailable: 0 },
      { id: "line-1", productVariantId: "variant-1", name: "Sérum", quantity: 1, unitPrice: 100, stockAvailable: 5 },
    ], total: 200, pendingBalance: 200 });
    api.getPublicQuotation.mockResolvedValue(quote);
    api.removePublicQuotationLine.mockResolvedValue(quotation({ paymentType: "ADELANTO" }));
    render(<PublicQuotationPage token="stock-token" />);

    expect(await screen.findByRole("button", { name: "Confirmar pedido" })).toBeDisabled();
    expect(screen.getByText("Ya no hay stock suficiente; quedan 0.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar del pedido" }));

    await waitFor(() => expect(api.removePublicQuotationLine).toHaveBeenCalledWith("stock-token", "empty-line"));
    expect(screen.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
    expect(screen.queryByText("Crema agotada")).not.toBeInTheDocument();
  });

  it("asks for another product before removing the only line", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({ lines: [
      { id: "only-line", name: "Crema", quantity: 1, unitPrice: 100, stockInsufficient: true, stockAvailable: 0 },
    ] }));
    render(<PublicQuotationPage token="stock-token" />);

    expect(await screen.findByRole("button", { name: "Quitar del pedido" })).toBeDisabled();
    expect(screen.getByText("Agrega otro producto antes de quitar el último del pedido.")).toBeInTheDocument();
    expect(api.removePublicQuotationLine).not.toHaveBeenCalled();
  });

  it("disables catalog products with zero or unknown stock and adds available products", async () => {
    const user = userEvent.setup({ delay: null });
    const items: QuotationCatalogItem[] = [
      { productVariantId: "empty", name: "Agotado", unitPrice: 10, stockAvailable: 0 },
      { productVariantId: "unknown", name: "Sin datos", unitPrice: 15, stockAvailable: null },
      { productVariantId: "available", name: "Disponible", unitPrice: 25, stockAvailable: 4 },
    ];
    api.getPublicQuotationCatalog.mockResolvedValue(items);
    api.addPublicQuotationLine.mockResolvedValue(quotation({ total: 125 }));
    render(<PublicQuotationPage token="catalog-token" />);

    await user.click(await screen.findByRole("button", { name: /Agregar más productos/ }));
    expect(await screen.findByRole("button", { name: "Sin stock" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No disponible" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(api.addPublicQuotationLine).toHaveBeenCalledWith("catalog-token", "available");
    expect(await screen.findByText("S/125.00")).toBeInTheDocument();
  });

  it("keeps an outstanding shipping balance visible after conversion", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", orderNumber: "ORD-000001", trackingStatus: "EN_ENVIO",
      paymentType: "ADELANTO", customerConfirmed: true,
      payments: [payment({ status: "APROBADO" })], approvedDeposit: 100,
      pendingBalance: 20, verifiedBalance: 20,
    }));
    render(<PublicQuotationPage token="converted-token" />);

    expect(await screen.findByText("Saldo pendiente contraentrega: S/20.00")).toBeInTheDocument();
    expect(screen.queryByText("Pedido pagado en su totalidad")).not.toBeInTheDocument();
    expect(screen.getByText("En camino").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: /Confirmar pedido|Pagar|Agregar más productos/ })).not.toBeInTheDocument();
  });

  it.each([
    { name: "pending advance and balance", payments: [payment({ amount: 30 })], pendingBalance: 70, verifiedBalance: 100 },
    { name: "approved full payment", payments: [payment({ status: "APROBADO" })], pendingBalance: 0, verifiedBalance: 0 },
  ])("shows a cancelled converted order without active delivery or payment claims: $name", async ({ payments, pendingBalance, verifiedBalance }) => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", orderNumber: "ORD-000001", trackingStatus: "ANULADO",
      paymentType: "ADELANTO", customerConfirmed: true, payments,
      pendingBalance, verifiedBalance,
    }));
    render(<PublicQuotationPage token="cancelled-token" />);

    expect(await screen.findByRole("heading", { name: "Tu pedido fue anulado" })).toBeInTheDocument();
    expect(screen.getByText("Tu pedido ORD-000001 fue anulado. Contacta al vendedor si necesitas ayuda.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumen del pedido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escribir al vendedor/ })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Estado del pedido" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pedido recibido")).not.toBeInTheDocument();
    expect(screen.queryByText(/Saldo pendiente|Pago por verificar|Pedido pagado en su totalidad/)).not.toBeInTheDocument();
    expect(screen.queryByText("Información de entrega")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar pedido|Pagar|Agregar más productos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Reportar un pago|Completa tu confirmación/ })).not.toBeInTheDocument();
  });

  it("replaces a prior confirmation notice when a refresh reports that the sale was cancelled", async () => {
    const user = userEvent.setup({ delay: null });
    const confirmed = quotation({ paymentType: "ADELANTO", customerConfirmed: true });
    api.getPublicQuotation.mockResolvedValueOnce(quotation({ paymentType: "ADELANTO" }));
    api.confirmPublicQuotation.mockResolvedValue(confirmed);
    render(<PublicQuotationPage token="cancelled-after-confirmation" />);

    await user.click(await screen.findByRole("button", { name: "Confirmar pedido" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Pedido confirmado.");
    api.getPublicQuotation.mockResolvedValue({ ...confirmed, status: "CONVERTIDA", trackingStatus: "ANULADO" });
    await user.click(screen.getByRole("button", { name: "Actualizar cotización" }));

    expect(await screen.findByRole("heading", { name: "Tu pedido fue anulado" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Estado del pedido" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Saldo pendiente|Pedido pagado en su totalidad/)).not.toBeInTheDocument();
  });

  it("uses the verified sale balance after Finance approves a converted order payment", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", customerConfirmed: true, payments: [payment()],
      depositAmount: 100, pendingBalance: 0, verifiedBalance: 0,
    }));
    render(<PublicQuotationPage token="converted-token" />);

    expect(await screen.findByText("Pedido pagado en su totalidad")).toBeInTheDocument();
    expect(screen.queryByText(/Pago por verificar/)).not.toBeInTheDocument();
  });

  it("does not treat a pending deposit projection as verified payment", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", customerConfirmed: true, payments: [payment()],
      depositAmount: 100, pendingBalance: 0, verifiedBalance: 100,
    }));
    render(<PublicQuotationPage token="converted-token" />);

    expect(await screen.findByText("Pago por verificar: S/100.00")).toBeInTheDocument();
    expect(screen.queryByText("Pedido pagado en su totalidad")).not.toBeInTheDocument();
    expect(screen.getByText("Saldo pendiente: S/0.00")).toBeInTheDocument();
  });

  it("ignores an old token response after navigating to another public quotation", async () => {
    let resolveOld: (quote: PublicQuotation) => void = () => {};
    api.getPublicQuotation.mockImplementation(token => token === "old-token"
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve(quotation({ number: "COT-0002", customerName: "Renzo" })));
    const { rerender } = render(<PublicQuotationPage token="old-token" />);
    rerender(<PublicQuotationPage token="new-token" />);

    expect(await screen.findByText("Hola, Renzo")).toBeInTheDocument();
    await act(async () => { resolveOld(quotation()); });

    expect(screen.getByText("COT-0002")).toBeInTheDocument();
    expect(screen.queryByText("Hola, María Quispe")).not.toBeInTheDocument();
  });
});
