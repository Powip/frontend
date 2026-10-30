import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicQuotationPage from "../PublicQuotationPage";
import * as service from "@/services/quotationService";
import type { PublicOrderTracking, PublicQuotation, QuotationCatalogItem, QuotationPayment } from "@/types/quotations";

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

const tracking = (overrides: Partial<PublicOrderTracking> = {}): PublicOrderTracking => ({
  orderNumber: "ORD-000099", status: "EN_ENVIO", deliveryType: "DOMICILIO",
  createdAt: "2026-10-27T12:00:00.000Z", customerNotes: "Sin ají.\nEntregar por la tarde.",
  customer: { fullName: "María Actualizada", address: "Av. Actualizada 456", district: "Cayma", city: "Arequipa", province: "Arequipa" },
  items: [{ productName: "Pedido actualizado", quantity: 2, unitPrice: 60, subtotal: 120, attributes: { Tamaño: "300 g" } }],
  totals: { grandTotal: 140, totalPaid: 40, pendingAmount: 100 },
  timeline: [
    { step: "PENDIENTE", label: "Pedido Recibido", completed: true, current: false },
    { step: "PREPARADO", label: "En Preparación", completed: true, current: false },
    { step: "EN_ENVIO", label: "En Camino", completed: false, current: true },
    { step: "ENTREGADO", label: "Entregado", completed: false, current: false },
  ],
  courier: "Shalom", businessName: "Tienda actual", businessPhone: "999111222",
  shippingInfo: {
    externalTrackingNumber: "GUIA-12345", shippingCode: "ENV-456",
    shalomDestinationAgency: "Agencia Cayma", trackingUrl: "https://tracking.example/GUIA-12345",
    shippingKey: null,
  },
  ...overrides,
});

describe("PublicQuotationPage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.getPublicQuotation.mockResolvedValue(quotation());
    api.getPublicQuotationCatalog.mockResolvedValue([]);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
    await user.selectOptions(screen.getByLabelText("Departamento"), "Lima");
    await user.selectOptions(screen.getByLabelText("Provincia"), "Lima");
    await user.selectOptions(screen.getByLabelText("Distrito"), "Breña");
    await user.type(screen.getByLabelText("Referencia (opcional)"), "  Frente al parque  ");
    await user.type(screen.getByLabelText("DNI (opcional)"), "12345678");
    await user.click(save);

    await waitFor(() => expect(api.savePublicQuotationAddress).toHaveBeenCalledWith("cod-token", {
      address: "Jr. Unión 123", department: "Lima", province: "Lima", district: "Breña",
      reference: "Frente al parque", documentNumber: "12345678",
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

  it("shows only catalog products with available stock and adds available products", async () => {
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
    expect(await screen.findByText("Disponible")).toBeInTheDocument();
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
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

  it("uses the current sale details, totals and timeline in the original quotation link", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", trackingStatus: "PENDIENTE", orderNumber: "OLD-ORDER",
      pendingBalance: 0, verifiedBalance: 0, tracking: tracking(),
      address: { address: "Calle anterior 123", district: "Lima" },
    }));
    render(<PublicQuotationPage token="original-quotation-token" />);

    expect(await screen.findByText("Hola, María Actualizada")).toBeInTheDocument();
    expect(api.getPublicQuotation).toHaveBeenCalledWith("original-quotation-token", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText(/Tu pedido ORD-000099 ya está registrado/)).toBeInTheDocument();
    expect(screen.getByText("Tienda actual")).toBeInTheDocument();
    expect(screen.getByText("Pedido actualizado")).toBeInTheDocument();
    expect(screen.getByText("Tamaño: 300 g")).toBeInTheDocument();
    expect(screen.queryByText("Sérum")).not.toBeInTheDocument();
    expect(screen.getByText("S/140.00")).toBeInTheDocument();
    expect(screen.getByText("Total del pedido")).toBeInTheDocument();
    expect(screen.getByText("Pagos aprobados: S/40.00")).toBeInTheDocument();
    expect(screen.getByText("Saldo pendiente: S/100.00")).toBeInTheDocument();
    expect(screen.queryByText("Pedido pagado en su totalidad")).not.toBeInTheDocument();
    expect(screen.getByText(/Sin ají/)).toHaveTextContent("Entregar por la tarde.");
    expect(screen.getByText("En Camino").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Estado actual: En camino")).toBeInTheDocument();
    expect(screen.getByText("Cayma, Arequipa, Arequipa")).toBeInTheDocument();
    expect(screen.getByText("Av. Actualizada 456")).toBeInTheDocument();
    expect(screen.queryByText("Calle anterior 123", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("domicilio")).toBeInTheDocument();
    expect(screen.getByText("Shalom")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GUIA-12345" })).toHaveAttribute("href", "https://tracking.example/GUIA-12345");
    expect(screen.getByRole("link", { name: "Rastrear envío" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("ENV-456")).toBeInTheDocument();
    expect(screen.getByText("Agencia Cayma")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escribir al vendedor/ })).toHaveAttribute("href", expect.stringContaining("wa.me/51999111222"));
    expect(screen.queryByRole("button", { name: /Confirmar pedido|Pagar|Agregar más productos/ })).not.toBeInTheDocument();
  });

  it("withholds a pickup key until approved payments cover the current sale total", async () => {
    const user = userEvent.setup({ delay: null });
    const shippingInfo = { ...tracking().shippingInfo, shippingKey: "CLAVE-7890" };
    const unpaid = quotation({
      status: "CONVERTIDA", pendingBalance: 0, verifiedBalance: 0, payments: [payment()],
      tracking: tracking({ shippingInfo }),
    });
    api.getPublicQuotation.mockResolvedValueOnce(unpaid).mockResolvedValueOnce({
      ...unpaid, tracking: tracking({ shippingInfo, totals: { grandTotal: 140, totalPaid: 140, pendingAmount: 0 } }),
    });
    const { container } = render(<PublicQuotationPage token="payment-key-token" />);

    expect(await screen.findByText(/Para ver la clave debes saldar el total del pedido/)).toHaveTextContent("S/100.00 pendiente");
    expect(container).not.toHaveTextContent("CLAVE-7890");
    expect(screen.getByText("Pago por verificar: S/100.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actualizar cotización" }));

    expect(await screen.findByText("CLAVE-7890")).toBeInTheDocument();
    expect(screen.getByText("Pedido pagado en su totalidad")).toBeInTheDocument();
    expect(screen.queryByText(/Pago por verificar|Para ver la clave/)).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "ftp://tracking.example/file", "/relative-tracking"])(
    "renders the guide without an unsafe external link: %s", async (trackingUrl) => {
      api.getPublicQuotation.mockResolvedValue(quotation({
        status: "CONVERTIDA", tracking: tracking({ shippingInfo: { ...tracking().shippingInfo, trackingUrl } }),
      }));
      render(<PublicQuotationPage token="unsafe-link-token" />);

      expect(await screen.findByText("GUIA-12345")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "GUIA-12345" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Rastrear envío" })).not.toBeInTheDocument();
    },
  );

  it("keeps the accepted agency separate from an issued transport agency", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", tracking: tracking({
        delivery: { type: "AGENCY", department: "Ancash", province: "Huaraz", district: "Huaraz", address: "Av. Nueva 456", agency: "Agencia elegida Huaraz" },
      }),
    }));
    render(<PublicQuotationPage token="own-agency" />);
    expect(await screen.findByText("Agencia elegida Huaraz")).toBeInTheDocument();
    expect(screen.getByText("Av. Nueva 456")).toBeInTheDocument();
    expect(screen.getByText("Retiro en agencia")).toBeInTheDocument();
    expect(screen.getByText("Agencia Cayma")).toBeInTheDocument();
  });

  it("shows store pickup without inventing courier or dispatch information", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", tracking: tracking({
        status: "PREPARADO", deliveryType: "RETIRO_TIENDA", courier: null, shippingInfo: null,
        totals: { grandTotal: 120, totalPaid: 120, pendingAmount: 0 },
        timeline: [{ step: "PREPARADO", label: "Listo para retirar", completed: false, current: true }],
      }),
    }));
    render(<PublicQuotationPage token="pickup-token" />);

    expect(await screen.findByText("retiro tienda")).toBeInTheDocument();
    expect(screen.getByText("Listo para retirar").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("Courier asignado")).not.toBeInTheDocument();
    expect(screen.queryByText("Tu pedido fue despachado")).not.toBeInTheDocument();
    expect(screen.queryByText("Clave de retiro")).not.toBeInTheDocument();
  });

  it.each(["ANULADO", "LEAD"])("does not expose active logistics or a pickup key for %s sales", async (status) => {
    api.getPublicQuotation.mockResolvedValue(quotation({
      status: "CONVERTIDA", trackingStatus: "EN_ENVIO", tracking: tracking({
        status, shippingInfo: { ...tracking().shippingInfo, shippingKey: "CLAVE-OCULTA" },
        totals: { grandTotal: 140, totalPaid: 140, pendingAmount: 0 },
        timeline: [{ step: status, label: "Compra pendiente de confirmación", completed: false, current: true }],
      }),
    }));
    render(<PublicQuotationPage token="inactive-sale-token" />);

    expect(await screen.findByRole("heading", { name: status === "ANULADO" ? "Tu pedido fue anulado" : "Compra pendiente de confirmación" })).toBeInTheDocument();
    expect(screen.queryByText("Información de entrega")).not.toBeInTheDocument();
    expect(screen.queryByText("Tu pedido fue despachado")).not.toBeInTheDocument();
    expect(screen.queryByText("CLAVE-OCULTA")).not.toBeInTheDocument();
    expect(screen.queryByText("Pedido pagado en su totalidad")).not.toBeInTheDocument();
    expect(screen.getByText("Pagos aprobados registrados: S/140.00")).toBeInTheDocument();
    if (status === "ANULADO") expect(screen.queryByRole("list", { name: "Estado del pedido" })).not.toBeInTheDocument();
    else expect(screen.getByRole("list", { name: "Estado del pedido" }).children).toHaveLength(1);
  });

  it("keeps quotation data and actions before conversion even if tracking is supplied", async () => {
    api.getPublicQuotation.mockResolvedValue(quotation({ paymentType: "ADELANTO", tracking: tracking() }));
    render(<PublicQuotationPage token="unconverted-token" />);

    expect(await screen.findByText("Hola, María Quispe")).toBeInTheDocument();
    expect(screen.getByText("Sérum")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
    expect(screen.queryByText("Pedido actualizado")).not.toBeInTheDocument();
    expect(screen.queryByText("Tu pedido fue despachado")).not.toBeInTheDocument();
  });

  it("restores complete saved delivery details and resets dependent location selections", async () => {
    const user = userEvent.setup({ delay: null });
    api.getPublicQuotation.mockResolvedValue(quotation({ customerConfirmed: true, address: {
      address: "Calle Real 123", department: "AREQUIPA", province: "Arequipa", district: "Cayma",
      reference: "Puerta azul", documentNumber: "12345678",
    } }));
    render(<PublicQuotationPage token="saved-address-token" />);

    expect(await screen.findByLabelText("Dirección completa")).toHaveValue("Calle Real 123");
    expect(screen.getByLabelText("Departamento")).toHaveValue("Arequipa");
    expect(screen.getByLabelText("DNI (opcional)")).toHaveValue("12345678");
    expect(screen.getByLabelText("Referencia (opcional)")).toHaveValue("Puerta azul");
    await user.selectOptions(screen.getByLabelText("Departamento"), "Lima");
    expect(screen.getByLabelText("Provincia")).toHaveValue("");
    expect(screen.getByLabelText("Distrito")).toHaveValue("");
    expect(screen.getByLabelText("Distrito")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar dirección" })).toBeDisabled();
    expect(screen.getByLabelText("DNI (opcional)")).toHaveValue("12345678");
  });

  it("reuses the token-scoped catalog briefly while always refreshing payment state", async () => {
    const user = userEvent.setup({ delay: null });
    const now = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(now);
    render(<PublicQuotationPage token="cached-catalog-token" />);
    const toggle = await screen.findByRole("button", { name: /Agregar más productos/ });

    await user.click(toggle);
    expect(await screen.findByText("No hay productos disponibles.")).toBeInTheDocument();
    await user.click(toggle);
    await user.click(toggle);
    expect(api.getPublicQuotationCatalog).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Actualizar cotización" }));
    expect(api.getPublicQuotation).toHaveBeenCalledTimes(2);
    await user.click(toggle);
    clock.mockReturnValue(now + 31_000);
    await user.click(toggle);
    await waitFor(() => expect(api.getPublicQuotationCatalog).toHaveBeenCalledTimes(2));
  });

  it("deduplicates overlapping quote refreshes and aborts the request when its token changes", async () => {
    let resolveRefresh: (value: PublicQuotation) => void = () => {};
    api.getPublicQuotation.mockResolvedValueOnce(quotation()).mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const { rerender } = render(<PublicQuotationPage token="initial-token" />);
    const refreshButton = await screen.findByRole("button", { name: "Actualizar cotización" });
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    expect(api.getPublicQuotation).toHaveBeenCalledTimes(2);
    const signal = api.getPublicQuotation.mock.calls[1][1]?.signal;
    api.getPublicQuotation.mockResolvedValue(quotation({ number: "COT-NEW", customerName: "Renzo" }));
    rerender(<PublicQuotationPage token="next-token" />);
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText("Hola, Renzo")).toBeInTheDocument();
    await act(async () => resolveRefresh(quotation()));
    expect(screen.getByText("COT-NEW")).toBeInTheDocument();
  });

  it("pauses polling in hidden tabs and refreshes fresh payment state when visible", async () => {
    jest.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    const visibilityGetter = jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<PublicQuotationPage token="visibility-token" />);
    await act(async () => { await Promise.resolve(); });
    expect(api.getPublicQuotation).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { jest.advanceTimersByTime(90_000); });
    expect(api.getPublicQuotation).toHaveBeenCalledTimes(1);
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await Promise.resolve(); });
    expect(api.getPublicQuotation).toHaveBeenCalledTimes(2);
    visibilityGetter.mockRestore();
  });

  it("keeps loading more available after an empty stock-filtered page and searches the server", async () => {
    const user = userEvent.setup({ delay: null });
    const later = { productVariantId: "later", name: "Producto de otra página", sku: "SKU-TARDIO", unitPrice: 25, stockAvailable: 4 };
    api.getPublicQuotationCatalog.mockImplementation(async (_token, options) => {
      if (options?.search === "SKU-TARDIO") return { data: [later], page: 1, limit: 30, hasMore: false };
      return options?.page === 2
        ? { data: [later], page: 2, limit: 30, hasMore: false }
        : { data: [], page: 1, limit: 30, hasMore: true };
    });
    render(<PublicQuotationPage token="paged-token" />);
    await user.click(await screen.findByRole("button", { name: /Agregar más productos/ }));
    expect(await screen.findByText("No hay productos con stock en esta página. Puedes cargar más.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cargar más productos" }));
    expect(await screen.findByText("Producto de otra página")).toBeInTheDocument();
    expect(api.getPublicQuotationCatalog).toHaveBeenCalledWith("paged-token", expect.objectContaining({ page: 2, limit: 30, search: "" }));
    expect(screen.queryByRole("button", { name: "Cargar más productos" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar productos" }), { target: { value: "SKU-TARDIO" } });
    await waitFor(() => expect(api.getPublicQuotationCatalog).toHaveBeenCalledWith("paged-token", expect.objectContaining({ page: 1, limit: 30, search: "SKU-TARDIO" })));
    expect(await screen.findByText("Producto de otra página")).toBeInTheDocument();
  });

  it("cancels obsolete search requests and keeps catalog caches within the public token", async () => {
    const user = userEvent.setup({ delay: null });
    let resolveOld: (value: QuotationCatalogItem[]) => void = () => {};
    api.getPublicQuotationCatalog.mockImplementation(async (requestToken, options) => {
      if (options?.search === "Viejo") return new Promise(resolve => { resolveOld = resolve; });
      if (options?.search === "Nuevo") return [{ productVariantId: "new", name: "Producto Nuevo", unitPrice: 25, stockAvailable: 3 }];
      return requestToken === "next-catalog-token"
        ? [{ productVariantId: "other", name: "Producto de otra cotización", unitPrice: 15, stockAvailable: 1 }]
        : [];
    });
    const { rerender } = render(<PublicQuotationPage token="old-catalog-token" />);
    await user.click(await screen.findByRole("button", { name: /Agregar más productos/ }));
    expect(await screen.findByText("No hay productos disponibles.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar productos" }), { target: { value: "Viejo" } });
    await waitFor(() => expect(api.getPublicQuotationCatalog).toHaveBeenCalledWith("old-catalog-token", expect.objectContaining({ search: "Viejo" })));
    const oldSignal = api.getPublicQuotationCatalog.mock.calls.find(([, options]) => options?.search === "Viejo")?.[1]?.signal;
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar productos" }), { target: { value: "Nuevo" } });
    expect(await screen.findByText("Producto Nuevo")).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => resolveOld([{ productVariantId: "stale", name: "Producto Viejo", unitPrice: 10, stockAvailable: 2 }]));
    expect(screen.queryByText("Producto Viejo")).not.toBeInTheDocument();
    rerender(<PublicQuotationPage token="next-catalog-token" />);
    await user.click(await screen.findByRole("button", { name: /Agregar más productos/ }));
    expect(await screen.findByText("Producto de otra cotización")).toBeInTheDocument();
    expect(screen.queryByText("Producto Nuevo")).not.toBeInTheDocument();
    expect(api.getPublicQuotationCatalog).not.toHaveBeenCalledWith("next-catalog-token", expect.objectContaining({ search: "Nuevo" }));
  });
});
