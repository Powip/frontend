import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LeadPaymentsPanel from "../LeadPaymentsPanel";
import LeadPaymentLedger from "../LeadPaymentLedger";
import LeadDetailPanel from "../LeadDetailPanel";
import LeadPaymentsTab from "@/components/finanzas/LeadPaymentsTab";
import * as payments from "@/services/leadPaymentsService";
import * as commercial from "@/services/commercialLeadsService";
import type {
  LeadPayment,
  LeadPaymentCapabilities,
  LeadPaymentList,
} from "@/types/leadPayments";
import type { LeadDetail } from "@/types/leads";

jest.setTimeout(30000);
configure({ asyncUtilTimeout: 10000 });

let mockCompanyId = "company-a",
  mockActorId = "actor-a",
  mockStoreId: string | null = "store-a";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    selectedStoreId: mockStoreId,
    auth: {
      company: { id: mockCompanyId },
      user: { id: mockActorId, role: "FINANCE", permissions: [] },
    },
  }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("@/services/leadPaymentsService");
jest.mock("@/services/commercialLeadsService", () => ({
  getCommercialLead: jest.fn(),
  getCommercialLeadContext: jest.fn(),
  commercialLeadError: (error: unknown) =>
    error instanceof Error ? error.message : "Error de pagos",
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    orderId: string;
    orderNumber: string;
    canApprove: boolean;
    onPaymentUpdated: () => void;
  }) =>
    props.open ? (
      <div
        role="dialog"
        aria-label="Pago del pedido original"
        data-order-id={props.orderId}
        data-can-approve={String(props.canApprove)}
      >
        {props.orderNumber}
        <button onClick={props.onPaymentUpdated}>Pago actualizado</button>
      </div>
    ) : null,
}));

const capabilities: LeadPaymentCapabilities = {
  enabled: true,
  canView: true,
  canCapture: true,
  canReview: true,
};
const lead: LeadDetail = {
  id: "lead-a",
  companyId: "company-a",
  storeId: "store-a",
  typeCode: "WHATSAPP_CRM",
  status: "NUEVO",
  contactName: "Ana",
  contactPhone: "955111222",
  contactEmail: null,
  initialChannel: "WHATSAPP",
  createdBy: "actor-a",
  assignedSellerId: "actor-a",
  receivedAt: "2026-10-20T12:00:00Z",
  sourceCreatedAt: null,
  estimatedAmount: "100.00",
  currency: "USD",
  customFields: {},
  version: 3,
  lostReason: null,
  nextActionAt: null,
  legacyOrderId: null,
  convertedOrderId: null,
  confirmedAt: null,
  confirmedBy: null,
  confirmationBasis: null,
  conversionCommandId: null,
  conversionSnapshot: null,
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-20T12:00:00Z",
  activities: [],
};
const payment = (overrides: Partial<LeadPayment> = {}): LeadPayment => ({
  id: "advance-a",
  companyId: "company-a",
  leadId: "lead-a",
  currency: "USD",
  captureId: "capture-a",
  amount: "25.50",
  paymentMethod: "TRANSFERENCIA",
  status: "PENDING",
  leadPaymentVersion: 7,
  management: "LEAD_ADVANCE",
  paymentDate: "2026-10-20T12:00:00Z",
  externalReference: null,
  paymentProofUrl: null,
  notes: null,
  created_at: "2026-10-20T12:00:00Z",
  updated_at: "2026-10-20T12:00:00Z",
  order: null,
  ...overrides,
});
const list = (data: LeadPayment[] = []): LeadPaymentList => ({
  data,
  total: data.length,
  page: 1,
  limit: 25,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function mount(element: React.ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(element);
  });
  return view;
}
async function submitCapture() {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Monto del anticipo"), {
      target: { value: "25.50" },
    });
    fireEvent.change(screen.getByLabelText("Moneda del anticipo"), {
      target: { value: "USD" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar anticipo pendiente" }),
    );
  });
}
async function clickAsync(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockCompanyId = "company-a";
  mockActorId = "actor-a";
  mockStoreId = "store-a";
  window.history.replaceState({}, "", "/finanzas");
  jest
    .mocked(payments.getLeadPaymentCapabilities)
    .mockResolvedValue(capabilities);
  jest.mocked(payments.getLeadPayments).mockResolvedValue(list());
  jest.mocked(payments.listLeadPayments).mockResolvedValue(list());
  jest.mocked(payments.captureLeadPayment).mockResolvedValue(payment());
  jest.mocked(payments.uploadLeadPaymentProof).mockResolvedValue(payment());
  jest.mocked(payments.approveLeadPayment).mockResolvedValue(payment());
  jest.mocked(payments.rejectLeadPayment).mockResolvedValue(payment());
  jest.mocked(payments.changeLeadPaymentAmount).mockResolvedValue(payment());
  jest.mocked(commercial.getCommercialLead).mockResolvedValue(lead);
  jest.mocked(commercial.getCommercialLeadContext).mockResolvedValue({
    leadId: lead.id,
    order: null,
    sources: [],
    quotationId: null,
    liveCheckoutId: null,
  });
});

it.each(["panel", "finance"])(
  "%s checks the disabled capability before reading any monetary data",
  async (surface) => {
    jest.mocked(payments.getLeadPaymentCapabilities).mockResolvedValue({
      ...capabilities,
      enabled: false,
      canView: false,
      canCapture: false,
      canReview: false,
    });
    await mount(
      surface === "panel" ? (
        <LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />
      ) : (
        <LeadPaymentsTab onPaymentUpdated={jest.fn()} />
      ),
    );
    expect(
      screen.getByText(/todavía no están habilitados/),
    ).toBeInTheDocument();
    expect(payments.getLeadPayments).not.toHaveBeenCalled();
    expect(payments.listLeadPayments).not.toHaveBeenCalled();
    expect(payments.captureLeadPayment).not.toHaveBeenCalled();
  },
);

it("retries an uncertain capture with its original immutable identifier and payload", async () => {
  jest
    .mocked(payments.captureLeadPayment)
    .mockRejectedValueOnce(new Error("Respuesta interrumpida"))
    .mockResolvedValueOnce(payment());
  await mount(<LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />);
  await submitCapture();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Respuesta interrumpida",
  );
  expect(screen.getByLabelText("Monto del anticipo")).toBeDisabled();
  await clickAsync(
    screen.getByRole("button", { name: "Reintentar el mismo anticipo" }),
  );
  await waitFor(() =>
    expect(payments.captureLeadPayment).toHaveBeenCalledTimes(2),
  );
  const first = jest.mocked(payments.captureLeadPayment).mock.calls[0];
  const retry = jest.mocked(payments.captureLeadPayment).mock.calls[1];
  expect(retry).toEqual(first);
  expect(first[0]).toBe("lead-a");
  expect(first[1]).toMatchObject({ amount: 25.5, currency: "USD" });
  expect(first[1].captureId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(first[1]).not.toHaveProperty("orderId");
});

it("retries only the proof after a saved advance, using the same payment identity and current version", async () => {
  const proof = new File(["proof"], "voucher.pdf", { type: "application/pdf" });
  jest
    .mocked(payments.getLeadPayments)
    .mockResolvedValueOnce(list())
    .mockResolvedValue(list([payment({ leadPaymentVersion: 9 })]));
  jest
    .mocked(payments.uploadLeadPaymentProof)
    .mockRejectedValueOnce(new Error("Archivo interrumpido"))
    .mockResolvedValueOnce(payment({ leadPaymentVersion: 10 }));
  await mount(<LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Comprobante del anticipo"), {
    target: { files: [proof] },
  });
  await submitCapture();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "El anticipo ya está guardado",
  );
  const retryProof = screen.getByRole("button", {
    name: "Reintentar sólo el comprobante",
  });
  await waitFor(() => expect(retryProof).toBeEnabled());
  await clickAsync(retryProof);
  await waitFor(() =>
    expect(payments.uploadLeadPaymentProof).toHaveBeenCalledTimes(2),
  );
  expect(payments.uploadLeadPaymentProof).toHaveBeenNthCalledWith(
    2,
    "lead-a",
    "advance-a",
    9,
    proof,
  );
  expect(payments.captureLeadPayment).toHaveBeenCalledTimes(1);
});

it("keeps USD and PEN approval totals separate and never lets a seller approve from the Lead panel", async () => {
  jest.mocked(payments.getLeadPayments).mockResolvedValue(
    list([
      payment({ id: "usd-paid", status: "PAID", amount: "12.00" }),
      payment({
        id: "pen-paid",
        status: "PAID",
        amount: "30.00",
        currency: "PEN",
      }),
      payment({ id: "usd-pending", amount: "5.00" }),
    ]),
  );
  await mount(<LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />);
  expect(
    screen.getByText(/Aprobado: USD 12.00 · Pendiente: USD 5.00/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Aprobado: PEN 30.00 · Pendiente: PEN 0.00/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/USD 42.00|PEN 42.00/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Aprobar anticipo" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Revisar pagos en Finanzas" }),
  ).toHaveAttribute("href", "/finanzas?tab=anticiposLeads&leadId=lead-a");
});

it("uses the lead anchor and reviewed version for Finance approval and amount corrections", async () => {
  const onChanged = jest.fn();
  await mount(
    <LeadPaymentLedger
      payments={[payment()]}
      canReview
      canUpload={false}
      onChanged={onChanged}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nota de revisión advance-a"), {
    target: { value: "  Validado en banco  " },
  });
  await clickAsync(screen.getByRole("button", { name: "Aprobar anticipo" }));
  await waitFor(() =>
    expect(payments.approveLeadPayment).toHaveBeenCalledWith(
      "lead-a",
      "advance-a",
      { version: 7, notes: "Validado en banco" },
    ),
  );
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Corregir monto" }));
  fireEvent.change(screen.getByLabelText("Monto corregido advance-a"), {
    target: { value: "26.75" },
  });
  await clickAsync(screen.getByRole("button", { name: "Guardar monto" }));
  await waitFor(() =>
    expect(payments.changeLeadPaymentAmount).toHaveBeenCalledWith(
      "lead-a",
      "advance-a",
      { version: 7, amount: 26.75 },
    ),
  );
  expect(payments.captureLeadPayment).not.toHaveBeenCalled();
});

it("keeps original order payments on their existing review modal instead of the advance mutation API", async () => {
  const onChanged = jest.fn();
  await mount(
    <LeadPaymentLedger
      payments={[
        payment({
          id: "original-payment",
          leadId: null,
          leadPaymentVersion: null,
          management: "ORDER_PAYMENT",
          commercialLeadId: "lead-a",
          order: { id: "original-order", orderNumber: "PED-001" },
        }),
      ]}
      canReview
      canUpload
      onChanged={onChanged}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Aprobar anticipo" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Comprobante original-payment"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Gestionar pago del pedido" }),
  );
  const modal = screen.getByRole("dialog", {
    name: "Pago del pedido original",
  });
  expect(modal).toHaveAttribute("data-order-id", "original-order");
  expect(modal).toHaveAttribute("data-can-approve", "true");
  fireEvent.click(
    within(modal).getByRole("button", { name: "Pago actualizado" }),
  );
  expect(onChanged).toHaveBeenCalledTimes(1);
  expect(payments.approveLeadPayment).not.toHaveBeenCalled();
  expect(payments.changeLeadPaymentAmount).not.toHaveBeenCalled();
});

it("does not read Finance payments for an actor without review capability", async () => {
  jest
    .mocked(payments.getLeadPaymentCapabilities)
    .mockResolvedValue({ ...capabilities, canReview: false });
  await mount(<LeadPaymentsTab onPaymentUpdated={jest.fn()} />);
  expect(screen.getByText(/No tienes permiso de Finanzas/)).toBeInTheDocument();
  expect(payments.listLeadPayments).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Aprobar anticipo" }),
  ).not.toBeInTheDocument();
});

it("explicitly changes from a store queue to the company queue, including unassigned Leads", async () => {
  await mount(<LeadPaymentsTab onPaymentUpdated={jest.fn()} />);
  expect(payments.listLeadPayments).toHaveBeenLastCalledWith({
    storeId: "store-a",
    leadId: undefined,
    status: "PENDING",
    page: 1,
    limit: 25,
  });
  fireEvent.change(screen.getByLabelText("Alcance de pagos de Leads"), {
    target: { value: "COMPANY" },
  });
  await waitFor(() =>
    expect(payments.listLeadPayments).toHaveBeenLastCalledWith({
      storeId: undefined,
      leadId: undefined,
      status: "PENDING",
      page: 1,
      limit: 25,
    }),
  );
  fireEvent.change(screen.getByLabelText("Estado de pagos de Leads"), {
    target: { value: "PAID" },
  });
  await waitFor(() =>
    expect(payments.listLeadPayments).toHaveBeenLastCalledWith({
      storeId: undefined,
      leadId: undefined,
      status: "PAID",
      page: 1,
      limit: 25,
    }),
  );
});

it("reacts to a new deep-linked Lead without remounting the Finance queue or accepting its old response", async () => {
  const previous = deferred<LeadPaymentList>();
  jest.mocked(payments.listLeadPayments).mockImplementation(async (params) => {
    if (params?.leadId === "lead-a") return previous.promise;
    return list([payment({ id: "lead-b-payment", leadId: "lead-b" })]);
  });
  const view = await mount(
    <LeadPaymentsTab requestedLeadId="lead-a" onPaymentUpdated={jest.fn()} />,
  );
  await waitFor(() =>
    expect(payments.listLeadPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ leadId: "lead-a" }),
    ),
  );
  await act(async () => {
    view.rerender(
      <LeadPaymentsTab requestedLeadId="lead-b" onPaymentUpdated={jest.fn()} />,
    );
  });
  expect(payments.listLeadPayments).toHaveBeenLastCalledWith(
    expect.objectContaining({ leadId: "lead-b", page: 1 }),
  );
  expect(screen.getByLabelText("Pago lead-b-payment")).toBeInTheDocument();
  await act(async () => {
    previous.resolve(list([payment({ id: "old-linked-payment" })]));
  });
  expect(
    screen.queryByLabelText("Pago old-linked-payment"),
  ).not.toBeInTheDocument();
  await clickAsync(
    screen.getByRole("button", { name: "Quitar filtro de Lead" }),
  );
  expect(payments.listLeadPayments).toHaveBeenLastCalledWith(
    expect.objectContaining({ leadId: undefined, page: 1 }),
  );
});

it("shows a failed Finance read as an error rather than a successful zero-payment report", async () => {
  jest
    .mocked(payments.listLeadPayments)
    .mockRejectedValue(new Error("La lectura no está disponible"));
  await mount(<LeadPaymentsTab onPaymentUpdated={jest.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "La lectura no está disponible",
  );
  expect(screen.queryByText(/0 pagos encontrados/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/No hay pagos registrados/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Actualizar pagos" }),
  ).toBeEnabled();
});

it.each(["company", "actor", "store"])(
  "ignores a late Finance response after the %s scope changes",
  async (dimension) => {
    const previous = deferred<LeadPaymentList>();
    jest
      .mocked(payments.listLeadPayments)
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValue(
        list([payment({ id: "current-payment", amount: "88.00" })]),
      );
    const view = await mount(<LeadPaymentsTab onPaymentUpdated={jest.fn()} />);
    expect(payments.listLeadPayments).toHaveBeenCalledTimes(1);
    if (dimension === "company") mockCompanyId = "company-b";
    if (dimension === "actor") mockActorId = "actor-b";
    if (dimension === "store") mockStoreId = "store-b";
    await act(async () => {
      view.rerender(<LeadPaymentsTab onPaymentUpdated={jest.fn()} />);
    });
    expect(
      await screen.findByLabelText("Pago current-payment"),
    ).toBeInTheDocument();
    await act(async () => {
      previous.resolve(
        list([payment({ id: "previous-payment", amount: "999.00" })]),
      );
    });
    expect(
      screen.queryByLabelText("Pago previous-payment"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("USD 999.00")).not.toBeInTheDocument();
  },
);

it("ignores an old Lead payment read after the actor changes", async () => {
  const previous = deferred<LeadPaymentList>();
  jest
    .mocked(payments.getLeadPayments)
    .mockReturnValueOnce(previous.promise)
    .mockResolvedValue(list([payment({ id: "new-actor-payment" })]));
  const view = await mount(
    <LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />,
  );
  mockActorId = "actor-b";
  await act(async () => {
    view.rerender(<LeadPaymentsPanel lead={lead} onChanged={jest.fn()} />);
  });
  expect(
    await screen.findByLabelText("Pago new-actor-payment"),
  ).toBeInTheDocument();
  await act(async () => {
    previous.resolve(list([payment({ id: "old-actor-payment" })]));
  });
  expect(
    screen.queryByLabelText("Pago old-actor-payment"),
  ).not.toBeInTheDocument();
});

it("keeps a failed proof retry and its file mounted while the parent Lead detail refreshes", async () => {
  const refreshing = deferred<LeadDetail>();
  const proof = new File(["proof"], "voucher.pdf", { type: "application/pdf" });
  jest
    .mocked(commercial.getCommercialLead)
    .mockResolvedValueOnce(lead)
    .mockReturnValueOnce(refreshing.promise)
    .mockResolvedValue(lead);
  jest
    .mocked(payments.getLeadPayments)
    .mockResolvedValueOnce(list())
    .mockResolvedValue(list([payment()]));
  jest
    .mocked(payments.uploadLeadPaymentProof)
    .mockRejectedValueOnce(new Error("Comprobante interrumpido"))
    .mockResolvedValueOnce(payment({ leadPaymentVersion: 8 }));
  await mount(
    <LeadDetailPanel
      id={lead.id}
      companyId="company-a"
      types={[]}
      stores={[{ id: "store-a", name: "Tienda A" }]}
      capabilities={{
        enabled: true,
        phase: "foundation",
        canView: true,
        canManage: false,
        canManageTypes: false,
      }}
      confirmationCapabilities={null}
      onChanged={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Comprobante del anticipo"), {
    target: { files: [proof] },
  });
  await submitCapture();
  const retry = await screen.findByRole("button", {
    name: "Reintentar sólo el comprobante",
  });
  expect(screen.getByText("Actualizando Lead…")).toBeInTheDocument();
  expect(retry).toBeDisabled();
  await act(async () => {
    refreshing.resolve(lead);
  });
  await waitFor(() => expect(retry).toBeEnabled());
  await clickAsync(retry);
  await waitFor(() =>
    expect(payments.uploadLeadPaymentProof).toHaveBeenCalledTimes(2),
  );
  expect(payments.uploadLeadPaymentProof).toHaveBeenLastCalledWith(
    "lead-a",
    "advance-a",
    7,
    proof,
  );
  expect(payments.captureLeadPayment).toHaveBeenCalledTimes(1);
});

it("ignores a late proof retry after switching actors and releases the new actor's form", async () => {
  const uploading = deferred<LeadPayment>();
  const proof = new File(["proof"], "voucher.pdf", { type: "application/pdf" });
  const onChanged = jest.fn();
  jest.mocked(payments.getLeadPayments).mockResolvedValue(list([payment()]));
  jest
    .mocked(payments.uploadLeadPaymentProof)
    .mockRejectedValueOnce(new Error("Comprobante interrumpido"))
    .mockReturnValueOnce(uploading.promise);
  const view = await mount(
    <LeadPaymentsPanel lead={lead} onChanged={onChanged} />,
  );
  fireEvent.change(screen.getByLabelText("Comprobante del anticipo"), {
    target: { files: [proof] },
  });
  await submitCapture();
  const retryProof = await screen.findByRole("button", {
    name: "Reintentar sólo el comprobante",
  });
  await waitFor(() => expect(retryProof).toBeEnabled());
  await clickAsync(retryProof);
  await waitFor(() =>
    expect(payments.uploadLeadPaymentProof).toHaveBeenCalledTimes(2),
  );
  const priorNotifications = onChanged.mock.calls.length;
  mockActorId = "actor-b";
  await act(async () => {
    view.rerender(<LeadPaymentsPanel lead={lead} onChanged={onChanged} />);
  });
  expect(
    screen.queryByRole("button", { name: "Reintentar sólo el comprobante" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    uploading.resolve(payment({ leadPaymentVersion: 8 }));
  });
  expect(onChanged).toHaveBeenCalledTimes(priorNotifications);
  expect(
    screen.getByRole("button", { name: "Registrar anticipo pendiente" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Monto del anticipo")).toBeEnabled();
});
