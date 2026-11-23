import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import ArmarPedidoTools, { type ToolCartLine } from "@/components/ventas-chat/ArmarPedidoTools";
import {
  CodSection,
  FinanceQueueSection,
  PaymentPolicySection,
  ReceiptsSection,
} from "@/components/ventas-chat/OrderPanelSections";
import * as crm from "@/services/crmService";
import * as panel from "@/services/crmOrderPanelService";
import type { Conversation } from "@/types/crm";
import type { CodOrder, PaymentReceipt, StorePolicy } from "@/types/crmOrderPanel";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
const toastMock = { error: jest.fn(), success: jest.fn(), info: jest.fn() };
jest.mock("sonner", () => ({
  toast: {
    error: (m: string) => toastMock.error(m),
    success: (m: string) => toastMock.success(m),
    info: (m: string) => toastMock.info(m),
  },
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "co1", stores: [{ id: "st1", name: "Tienda Centro" }] } },
    selectedStoreId: "st1",
    hasPermission: () => false,
  }),
}));
const me = { isSupervisor: true };
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: me.isSupervisor ? "admin" : "agent",
    isAdmin: me.isSupervisor,
    isSupervisor: me.isSupervisor,
    stores: [{ id: "st1", name: "Tienda Centro" }],
    fromServer: true,
  }),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listConversationOrders: jest.fn(),
}));
jest.mock("@/services/crmOrderPanelService", () => ({
  getStorePolicy: jest.fn(),
  saveStorePolicy: jest.fn(),
  getPromos: jest.fn(),
  evaluatePromos: jest.fn(),
  requestDiscount: jest.fn(),
  listDiscountRequests: jest.fn(),
  decideDiscount: jest.fn(),
  buildAiCart: jest.fn(),
  listReceipts: jest.fn(),
  uploadReceipt: jest.fn(),
  simulatePayment: jest.fn(),
  listFinanceQueue: jest.fn(),
  getReceiptFile: jest.fn(),
  reviewReceipt: jest.fn(),
  getCodOrder: jest.fn(),
  confirmCod: jest.fn(),
  cancelCod: jest.fn(),
  rescheduleCod: jest.fn(),
  updateCodDni: jest.fn(),
}));
// Radix (Switch/Select del diálogo) usa ResizeObserver, que jsdom no trae.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= ResizeObserverStub;

const c = crm as jest.Mocked<typeof crm>;
const p = panel as jest.Mocked<typeof panel>;

const conv = { id: "c1", channel: "whatsapp", storeId: "st1", contactName: "Ana" } as unknown as Conversation;

const POLICY: StorePolicy = {
  storeId: "st1",
  saved: true,
  shipCharge: 10,
  firstOffer: "dep",
  depositEnabled: true,
  depositAmount: 20,
  codFull: false,
  codAsk: "confirm",
  discountCap: 10,
  promoText: "¡2x1 en polos este fin de semana!",
  quantityPromos: [{ minQty: 3, percent: 10, label: "3+ polos -10%" }],
};

function receipt(over: Partial<PaymentReceipt> = {}): PaymentReceipt {
  return {
    id: "r1",
    conversationId: "c1",
    orderId: null,
    orderNumber: null,
    quotationId: null,
    status: "porval",
    method: "YAPE",
    methodLabel: "Yape",
    amount: 50,
    operationNumber: "123456",
    mime: "image/png",
    fileName: "voucher.png",
    hasFile: true,
    destination: "local",
    coreError: null,
    uploadedByName: "Vendedora 1",
    reviewedByName: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: "2026-11-23T10:00:00.000Z",
    ...over,
  };
}

function codOrder(over: Partial<CodOrder> = {}): CodOrder {
  return {
    id: "o1",
    orderNumber: "PED-0001",
    storeId: "st1",
    status: "PENDIENTE",
    subEstadoCc: "por_confirmar",
    dniCliente: null,
    dniValid: false,
    customerName: "Ana",
    phoneNumber: null,
    address: null,
    district: null,
    city: null,
    province: null,
    referenciaEntrega: null,
    courier: "Shalom",
    total: 80,
    paymentMethod: "CONTRA_ENTREGA",
    ...over,
  };
}

function axios400(code: string) {
  const headers = new AxiosHeaders();
  return new AxiosError("Bad Request", "ERR_BAD_REQUEST", { headers }, null, {
    status: 400,
    statusText: "Bad Request",
    headers: {},
    config: { headers },
    data: { code, message: "Falta DNI" },
  });
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const POLO: ToolCartLine = {
  productVariantId: "v1",
  name: "Polo básico",
  variant: "M",
  sku: "POL-M",
  unitPrice: 50,
  quantity: 2,
  stock: 5,
};

function ToolsHarness({ initial = [], onInsert }: { initial?: ToolCartLine[]; onInsert?: (t: string) => void }) {
  const [cart, setCart] = useState<ToolCartLine[]>(initial);
  return (
    <>
      <ArmarPedidoTools
        conversationId="c1"
        storeId="st1"
        inventoryId="inv1"
        cart={cart}
        setCart={setCart}
        onInsertMessage={onInsert}
      />
      <ul aria-label="carrito">
        {cart.map((l) => (
          <li key={l.productVariantId}>{`${l.name}|${l.quantity}|${l.unitPrice}`}</li>
        ))}
      </ul>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  me.isSupervisor = true;
  p.getStorePolicy.mockResolvedValue(POLICY);
  p.listDiscountRequests.mockResolvedValue([]);
  p.evaluatePromos.mockResolvedValue({
    source: "local",
    warning: null,
    bundles: [],
    quantityPromos: [],
    discountCap: 10,
    promoText: "",
    quantityHits: [],
    combos: [],
  });
  p.listReceipts.mockResolvedValue([]);
  p.listFinanceQueue.mockResolvedValue([]);
  c.listConversationOrders.mockResolvedValue([]);
});

describe("ArmarPedidoTools (filas 23 y 24)", () => {
  it("arma el carrito con la IA (lector local sin llave) y muestra lo que leyó", async () => {
    p.buildAiCart.mockResolvedValue({
      source: "mock",
      model: null,
      warning: "Sin llave de IA: se usó el lector local.",
      storeId: "st1",
      lines: [
        {
          productVariantId: "v1",
          name: "Polo básico",
          quantity: 3,
          unitPrice: 50,
          evidence: "quiero 3 polos",
          stockAvailable: 5,
          sku: "POL-M",
          variant: "M",
        },
      ],
    });
    wrap(<ToolsHarness />);
    fireEvent.click(screen.getByRole("button", { name: /Armar con IA/ }));
    expect(await screen.findByTestId("ai-source")).toHaveTextContent("Lector local (sin llave de IA)");
    expect(p.buildAiCart).toHaveBeenCalledWith("c1", { storeId: "st1", inventoryId: "inv1" });
    expect(screen.getByText("Sin llave de IA: se usó el lector local.")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Lo que leyó la IA")).getByText(/quiero 3 polos/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("carrito")).getByText("Polo básico|3|50")).toBeInTheDocument();
  });

  it("aplica el descuento dentro del tope sobre el precio de lista y lo quita", async () => {
    p.requestDiscount.mockResolvedValue({ approved: true, percent: 10, cap: 10, request: null });
    wrap(<ToolsHarness initial={[POLO]} />);
    await screen.findByText(/Tope de descuento 10 %/);
    fireEvent.change(screen.getByLabelText("Descuento (%)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Polo básico|2|45")).toBeInTheDocument();
    expect(p.requestDiscount).toHaveBeenCalledWith("c1", { percent: 10, storeId: "st1" });
    expect(screen.getByTestId("armar-ahorro")).toHaveTextContent("ahorro S/10.00");
    fireEvent.click(screen.getByRole("button", { name: "Quitar descuentos" }));
    expect(await screen.findByText("Polo básico|2|50")).toBeInTheDocument();
  });

  it("si pasa el tope no cambia precios y pide permiso al supervisor", async () => {
    p.requestDiscount.mockResolvedValue({
      approved: false,
      percent: 25,
      cap: 10,
      request: {
        id: "d1",
        conversationId: "c1",
        percent: 25,
        cap: 10,
        status: "pendiente",
        reason: "cliente frecuente",
        requestedByName: "Vendedora",
        decidedByName: null,
        decidedAt: null,
        createdAt: "2026-11-23T10:00:00.000Z",
      },
    });
    wrap(<ToolsHarness initial={[POLO]} />);
    await screen.findByText(/Tope de descuento 10 %/);
    fireEvent.change(screen.getByLabelText("Descuento (%)"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Motivo (si pasa el tope)"), { target: { value: "cliente frecuente" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith(expect.stringContaining("tope de 10 %")));
    expect(p.requestDiscount).toHaveBeenCalledWith("c1", { percent: 25, storeId: "st1", reason: "cliente frecuente" });
    expect(screen.getByText("Polo básico|2|50")).toBeInTheDocument();
  });

  it("aplica la promo por cantidad sugerida y deja el texto de la promo en el chat", async () => {
    p.evaluatePromos.mockResolvedValue({
      source: "core",
      warning: null,
      bundles: [],
      quantityPromos: POLICY.quantityPromos,
      discountCap: 10,
      promoText: POLICY.promoText,
      quantityHits: [{ label: "3+ polos -10%", percent: 10, productVariantIds: ["v1"], saving: 15 }],
      combos: [],
    });
    const onInsert = jest.fn();
    wrap(<ToolsHarness initial={[{ ...POLO, quantity: 3 }]} onInsert={onInsert} />);
    const hit = await screen.findByText(/3\+ polos -10%/, {}, { timeout: 2000 });
    fireEvent.click(within(hit.closest("div") as HTMLElement).getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Polo básico|3|45")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar promo/ }));
    expect(onInsert).toHaveBeenCalledWith(POLICY.promoText);
  });
});

describe("Política de pagos por tienda (fila 25)", () => {
  it("muestra el resumen y el supervisor la edita", async () => {
    p.saveStorePolicy.mockResolvedValue({ ...POLICY, discountCap: 15 });
    wrap(<PaymentPolicySection conversation={conv} />);
    const summary = await screen.findByTestId("policy-summary");
    expect(summary).toHaveTextContent("Primera oferta: Adelanto");
    expect(summary).toHaveTextContent("Descuento sin permiso: hasta 10 %");
    fireEvent.click(screen.getByRole("button", { name: "Editar política" }));
    fireEvent.change(await screen.findByLabelText("Tope de descuento (%)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(p.saveStorePolicy).toHaveBeenCalled());
    expect(p.saveStorePolicy.mock.calls[0][0]).toMatchObject({ storeId: "st1", discountCap: 15, firstOffer: "dep" });
    expect(p.saveStorePolicy.mock.calls[0][0]).not.toHaveProperty("saved");
  });

  it("la vendedora no ve el botón de editar", async () => {
    me.isSupervisor = false;
    wrap(<PaymentPolicySection conversation={conv} />);
    await screen.findByTestId("policy-summary");
    expect(screen.queryByRole("button", { name: "Editar política" })).not.toBeInTheDocument();
  });
});

describe("Comprobantes y Finanzas (fila 26)", () => {
  it("sube el comprobante con el pedido del chat y lo envía a Finanzas", async () => {
    c.listConversationOrders.mockResolvedValue([
      { id: "l1", orderId: "o1", orderNumber: "PED-0001", createdAt: "2026-11-23T10:00:00.000Z" },
    ] as never);
    p.uploadReceipt.mockResolvedValue(receipt({ destination: "core", orderId: "o1", orderNumber: "PED-0001" }));
    wrap(<ReceiptsSection conversation={conv} />);
    fireEvent.click(await screen.findByRole("button", { name: /Subir comprobante/ }));
    fireEvent.change(screen.getByLabelText("Monto (S/)"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("N.° de operación"), { target: { value: "123456" } });
    await screen.findByRole("option", { name: "PED-0001" });
    fireEvent.change(screen.getByLabelText("Pedido"), { target: { value: "o1" } });
    const file = new File(["x"], "voucher.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Foto o PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar a Finanzas/ }));
    await waitFor(() =>
      expect(p.uploadReceipt).toHaveBeenCalledWith("c1", {
        method: "YAPE",
        amount: 50,
        file,
        operationNumber: "123456",
        orderId: "o1",
      }),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Comprobante enviado a Finanzas"));
  });

  it("sin archivo no envía; Simular pago registra un pago de prueba", async () => {
    p.simulatePayment.mockResolvedValue(receipt({ destination: "simulated", status: "aprobado" }));
    wrap(<ReceiptsSection conversation={conv} />);
    fireEvent.click(await screen.findByRole("button", { name: /Subir comprobante/ }));
    fireEvent.change(screen.getByLabelText("Monto (S/)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar a Finanzas/ }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Adjunta la foto o PDF del comprobante."));
    expect(p.uploadReceipt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Simular pago" }));
    await waitFor(() => expect(p.simulatePayment).toHaveBeenCalledWith("c1", { amount: 30, method: "YAPE" }));
  });

  it("lista los comprobantes con estado y destino", async () => {
    p.listReceipts.mockResolvedValue([receipt({ destination: "simulated", status: "aprobado" })]);
    wrap(<ReceiptsSection conversation={conv} />);
    const row = await screen.findByTestId("receipt-row");
    expect(row).toHaveTextContent("Aprobado");
    expect(row).toHaveTextContent("Simulado");
  });

  it("Finanzas aprueba con nota", async () => {
    p.listFinanceQueue.mockResolvedValue([receipt()]);
    p.reviewReceipt.mockResolvedValue(receipt({ status: "aprobado" }));
    wrap(<FinanceQueueSection />);
    expect(await screen.findByText("Pagos por validar (1)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nota de revisión"), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(p.reviewReceipt).toHaveBeenCalledWith("r1", true, "ok"));
  });

  it("la cola de Finanzas no aparece para quien no es supervisor ni tiene VIEW_FINANCES", async () => {
    me.isSupervisor = false;
    p.listFinanceQueue.mockResolvedValue([receipt()]);
    wrap(<FinanceQueueSection />);
    await act(async () => {});
    expect(screen.queryByText(/Pagos por validar/)).not.toBeInTheDocument();
    expect(p.listFinanceQueue).not.toHaveBeenCalled();
  });
});

describe("Contra entrega con Gestión CC (fila 27)", () => {
  beforeEach(() => {
    c.listConversationOrders.mockResolvedValue([
      { id: "l1", orderId: "o1", orderNumber: "PED-0001", createdAt: "2026-11-23T10:00:00.000Z" },
    ] as never);
  });

  it("Confirmar sin DNI pide el DNI y confirma con él", async () => {
    p.getCodOrder.mockResolvedValue(codOrder({ dniValid: true, dniCliente: "1234" }));
    p.confirmCod
      .mockRejectedValueOnce(axios400("DNI_REQUIRED"))
      .mockResolvedValueOnce(codOrder({ dniValid: true, dniCliente: "45678912", subEstadoCc: "confirmado" }));
    wrap(<CodSection conversation={conv} />);
    const card = await screen.findByTestId("cod-card");
    fireEvent.click(within(card).getByRole("button", { name: /Confirmar/ }));
    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith(expect.stringContaining("DNI")));
    expect(toastMock.error).not.toHaveBeenCalled();
    fireEvent.change(within(card).getByLabelText("DNI del cliente"), { target: { value: "4567-8912" } });
    fireEvent.click(within(card).getByRole("button", { name: "Confirmar con DNI" }));
    await waitFor(() => expect(p.confirmCod).toHaveBeenLastCalledWith("c1", "o1", "45678912"));
    expect(await within(card).findByText("confirmado")).toBeInTheDocument();
  });

  it("pedido sin etapa comercial pasa a Confirmada y deja de ofrecer Confirmar", async () => {
    p.getCodOrder.mockResolvedValue(codOrder({ dniValid: true, dniCliente: "45678912", confirmed: false, canConfirm: true }));
    p.confirmCod.mockResolvedValue(
      codOrder({ dniValid: true, dniCliente: "45678912", subEstadoCc: null, confirmed: true, canConfirm: false }),
    );
    wrap(<CodSection conversation={conv} />);
    const card = await screen.findByTestId("cod-card");
    fireEvent.click(within(card).getByRole("button", { name: /Confirmar/ }));
    expect(await within(card).findByTestId("cod-confirmed")).toHaveTextContent("Confirmada");
    expect(within(card).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("si Core ya no permite confirmar, oculta solo Confirmar", async () => {
    p.getCodOrder.mockResolvedValue(codOrder({ dniValid: true, dniCliente: "45678912", canConfirm: false }));
    wrap(<CodSection conversation={conv} />);
    const card = await screen.findByTestId("cod-card");
    expect(within(card).getByRole("button", { name: "Reprogramar" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it("Anular pide motivo y lo envía", async () => {
    p.getCodOrder.mockResolvedValue(codOrder({ dniValid: true, dniCliente: "45678912" }));
    p.cancelCod.mockResolvedValue(codOrder({ subEstadoCc: "anulado_cc" }));
    wrap(<CodSection conversation={conv} />);
    const card = await screen.findByTestId("cod-card");
    fireEvent.click(within(card).getByRole("button", { name: "Anular" }));
    fireEvent.change(within(card).getByLabelText("Motivo de anulación"), { target: { value: "datos_falsos" } });
    fireEvent.change(within(card).getByLabelText("Detalle de anulación"), { target: { value: "número no existe" } });
    fireEvent.click(within(card).getByRole("button", { name: "Anular pedido" }));
    await waitFor(() => expect(p.cancelCod).toHaveBeenCalledWith("c1", "o1", "datos_falsos", "número no existe"));
  });

  it("Reprogramar y guardar DNI cuando falta", async () => {
    p.getCodOrder.mockResolvedValue(codOrder());
    p.rescheduleCod.mockResolvedValue(codOrder({ subEstadoCc: "reprogramado" }));
    p.updateCodDni.mockResolvedValue(codOrder({ dniValid: true, dniCliente: "45678912" }));
    wrap(<CodSection conversation={conv} />);
    const card = await screen.findByTestId("cod-card");
    expect(card).toHaveTextContent("DNI pendiente");
    fireEvent.change(within(card).getByLabelText("DNI del cliente"), { target: { value: "45678912" } });
    fireEvent.click(within(card).getByRole("button", { name: "Guardar DNI" }));
    await waitFor(() => expect(p.updateCodDni).toHaveBeenCalledWith("c1", "o1", "45678912"));
    fireEvent.click(within(card).getByRole("button", { name: "Reprogramar" }));
    await waitFor(() => expect(p.rescheduleCod).toHaveBeenCalledWith("c1", "o1", undefined));
  });

  it("sin pedidos en el chat no muestra la sección", async () => {
    c.listConversationOrders.mockResolvedValue([]);
    wrap(<CodSection conversation={conv} />);
    await act(async () => {});
    expect(screen.queryByText(/Contra entrega/)).not.toBeInTheDocument();
  });
});
