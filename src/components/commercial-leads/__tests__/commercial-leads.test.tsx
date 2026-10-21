import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CommercialLeadsWorkspace from "../CommercialLeadsWorkspace";
import LeadContactForm from "../LeadContactForm";
import LeadTypeCatalog from "../LeadTypeCatalog";
import LeadDetailPanel from "../LeadDetailPanel";
import * as service from "@/services/commercialLeadsService";
import type { LeadCapabilities, LeadDetail, LeadType } from "@/types/leads";
import type { OrderHeader } from "@/interfaces/IOrder";

jest.setTimeout(30000);
configure({ asyncUtilTimeout: 10000 });

let mockCompanyId = "company-a",
  mockStoreId = "store-a",
  mockQuery = "";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    selectedStoreId: mockStoreId,
    auth: {
      user: {
        id: "actor",
        name: "Vendedora Actual",
        email: "seller@example.test",
      },
      company: {
        id: mockCompanyId,
        stores: [
          { id: "store-a", name: "Tienda A" },
          { id: "store-b", name: "Tienda B" },
        ],
      },
    },
  }),
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("@/services/commercialLeadsService");
jest.mock("@/services/leadPaymentsService");
jest.mock("@/components/commercial-leads/LeadPaymentsPanel", () => ({
  __esModule: true,
  default: () => <div>Pagos vinculados al Lead</div>,
}));
const catalog: LeadType = {
  companyId: "company-a",
  code: "FERIA_FUTURA",
  name: "Feria futura",
  active: true,
  fields: [
    {
      key: "interes",
      label: "Interés especial",
      type: "boolean",
      required: true,
    },
  ],
  schemaVersion: 1,
};
const lead = (overrides: Partial<LeadDetail> = {}): LeadDetail => ({
  id: "lead-a",
  companyId: "company-a",
  storeId: "store-a",
  typeCode: catalog.code,
  type: catalog,
  status: "NUEVO",
  contactName: "Ana feria",
  contactPhone: "955111222",
  contactEmail: null,
  initialChannel: "WHATSAPP",
  createdBy: "actor",
  assignedSellerId: "actor",
  receivedAt: "2026-10-20T12:00:00Z",
  sourceCreatedAt: null,
  estimatedAmount: "100.00",
  currency: "PEN",
  customFields: { interes: false },
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
  ...overrides,
});
const caps: LeadCapabilities = {
  enabled: true,
  phase: "foundation",
  canView: true,
  canManage: true,
  canManageTypes: true,
};
const order = {
  id: "order-a",
  orderNumber: "PED-001",
  updated_at: "2026-10-20T14:00:00Z",
  status: "PENDIENTE",
  grandTotal: "100.00",
  items: [
    { id: "line-a", productName: "Producto", quantity: 1, unitPrice: "100.00" },
  ],
  payments: [{ id: "payment-existing", amount: "30.00", status: "PAID" }],
} as unknown as OrderHeader;
async function renderWorkspace() {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<CommercialLeadsWorkspace />);
  });
  return view;
}
async function renderDetail(onChanged = jest.fn()) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <LeadDetailPanel
        id="lead-a"
        companyId="company-a"
        types={[catalog]}
        stores={[]}
        capabilities={caps}
        confirmationCapabilities={{ enabled: true, canConfirm: true }}
        onChanged={onChanged}
        onClose={jest.fn()}
      />,
    );
  });
  return view;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockCompanyId = "company-a";
  mockStoreId = "store-a";
  mockQuery = "";
  jest.mocked(service.getCommercialLeadCapabilities).mockResolvedValue(caps);
  jest
    .mocked(service.getCommercialLeadConfirmationCapabilities)
    .mockResolvedValue({ enabled: true, canConfirm: true });
  jest.mocked(service.listCommercialLeadTypes).mockResolvedValue([catalog]);
  jest
    .mocked(service.listCommercialLeads)
    .mockResolvedValue({ items: [lead()], total: 1, page: 1, limit: 25 });
  jest.mocked(service.getCommercialLead).mockResolvedValue(lead());
  jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
    leadId: "lead-a",
    order: null,
    sources: [],
    quotationId: null,
    liveCheckoutId: null,
  });
  jest
    .mocked(service.commercialLeadError)
    .mockImplementation((error) =>
      error instanceof Error ? error.message : "Error local",
    );
});
it("does not load contacts, catalogue or confirmation when feature is disabled", async () => {
  jest.mocked(service.getCommercialLeadCapabilities).mockResolvedValue({
    ...caps,
    enabled: false,
    canView: false,
    canManage: false,
    canManageTypes: false,
  });
  await renderWorkspace();
  expect(
    await screen.findByText(/todavía no está habilitado/),
  ).toBeInTheDocument();
  expect(service.listCommercialLeads).not.toHaveBeenCalled();
  expect(service.listCommercialLeadTypes).not.toHaveBeenCalled();
  expect(
    service.getCommercialLeadConfirmationCapabilities,
  ).not.toHaveBeenCalled();
  expect(service.bootstrapCommercialLeadTypes).not.toHaveBeenCalled();
});
it("supports future types, server pagination and resetting page when a filter changes", async () => {
  jest
    .mocked(service.listCommercialLeads)
    .mockResolvedValue({ items: [lead()], total: 60, page: 1, limit: 25 });
  await renderWorkspace();
  await screen.findByText("Ana feria");
  expect(
    screen.getByRole("option", { name: "Feria futura" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Tipo de lead"), {
    target: { value: "FERIA_FUTURA" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        typeCode: "FERIA_FUTURA",
        storeId: "store-a",
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Buscar contacto"), {
    target: { value: "955" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "955", page: 1 }),
    ),
  );
});
it("keeps read-only users from contact mutations and seller confirmation", async () => {
  jest
    .mocked(service.getCommercialLeadCapabilities)
    .mockResolvedValue({ ...caps, canManage: false, canManageTypes: false });
  jest
    .mocked(service.getCommercialLeadConfirmationCapabilities)
    .mockResolvedValue({ enabled: true, canConfirm: false });
  await renderWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: "Ana feria" }));
  await screen.findByText("Pagos vinculados al Lead");
  expect(
    screen.queryByRole("button", { name: "Nuevo Lead" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Editar contacto" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Marcar como perdido" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Preparar compra del Lead"),
  ).not.toBeInTheDocument();
});
it("does not let a late response from the previous company populate the new inbox", async () => {
  let resolveOld!: (
    value: Awaited<ReturnType<typeof service.listCommercialLeads>>,
  ) => void;
  jest.mocked(service.listCommercialLeads).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const view = await renderWorkspace();
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenCalledTimes(1),
  );
  mockCompanyId = "company-b";
  jest.mocked(service.listCommercialLeads).mockResolvedValue({
    items: [
      lead({
        id: "lead-b",
        companyId: "company-b",
        contactName: "Bea nuevo negocio",
      }),
    ],
    total: 1,
    page: 1,
    limit: 25,
  });
  await act(async () => {
    view.rerender(<CommercialLeadsWorkspace />);
  });
  await screen.findByText("Bea nuevo negocio");
  resolveOld({ items: [lead()], total: 1, page: 1, limit: 25 });
  await waitFor(() =>
    expect(screen.queryByText("Ana feria")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Bea nuevo negocio")).toBeInTheDocument();
});
it("keeps a failed create idempotent and submits required false custom values", async () => {
  jest
    .mocked(service.createCommercialLead)
    .mockRejectedValueOnce(new Error("Respuesta interrumpida"))
    .mockResolvedValueOnce(lead());
  const saved = jest.fn();
  render(
    <LeadContactForm
      types={[catalog]}
      stores={[]}
      onSaved={saved}
      onCancel={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nombre del contacto"), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Interés especial *"), {
    target: { value: "false" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar Lead" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Nombre del contacto")).toBeDisabled();
  expect(screen.getByLabelText("Tipo de lead")).toBeDisabled();
  expect(screen.getByLabelText("Interés especial *")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Nombre del contacto"), {
    target: { value: "Cambio posterior a la captura" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar el mismo Lead" }),
  );
  await waitFor(() => expect(saved).toHaveBeenCalled());
  const [first, second] = jest
    .mocked(service.createCommercialLead)
    .mock.calls.map(([input]) => input);
  expect(first.captureId).toMatch(/^[a-f\d-]{36}$/);
  expect(second).toEqual(first);
  expect(second.contactName).toBe("Ana");
  expect(second.customFields).toEqual({ interes: false });
  expect(second.estimatedAmount).toBeNull();
});

it("locks duplicate Lead submissions synchronously and ignores a saved result after unmount", async () => {
  let resolve!: (result: LeadDetail) => void;
  jest.mocked(service.createCommercialLead).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const saved = jest.fn();
  const view = render(
    <LeadContactForm
      types={[{ ...catalog, fields: [] }]}
      stores={[]}
      onSaved={saved}
      onCancel={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nombre del contacto"), {
    target: { value: "Ana" },
  });
  const form = screen.getByRole("form", { name: "Crear Lead" });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(service.createCommercialLead).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    resolve(lead());
  });
  expect(saved).not.toHaveBeenCalled();
});

it("locks duplicate catalogue updates and ignores their old workspace callback after unmount", async () => {
  let resolve!: (result: LeadType) => void;
  jest.mocked(service.updateCommercialLeadType).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const changed = jest.fn();
  const view = render(
    <LeadTypeCatalog types={[catalog]} onChanged={changed} />,
  );
  const deactivate = screen.getByRole("button", {
    name: "Desactivar Feria futura",
  });
  act(() => {
    fireEvent.click(deactivate);
    fireEvent.click(deactivate);
  });
  expect(service.updateCommercialLeadType).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    resolve({ ...catalog, active: false });
  });
  expect(changed).not.toHaveBeenCalled();
});
it("confirms an existing order with stable command and no copied payment or item payload", async () => {
  jest
    .mocked(service.getCommercialLead)
    .mockResolvedValue(lead({ legacyOrderId: "order-a" }));
  jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
    leadId: "lead-a",
    order,
    sources: [],
    quotationId: null,
    liveCheckoutId: null,
  });
  jest
    .mocked(service.confirmCommercialLead)
    .mockRejectedValueOnce(new Error("Intenta nuevamente"))
    .mockResolvedValueOnce({
      lead: lead({ status: "CONVERTIDO", convertedOrderId: "order-a" }),
      order,
      replayed: true,
    });
  await renderWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: "Ana feria" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Revisar y confirmar compra" }),
  );
  expect(
    screen.getByText("Confirmará: Vendedora Actual (tú)"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
  await screen.findByText("Intenta nuevamente");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
  await waitFor(() =>
    expect(service.confirmCommercialLead).toHaveBeenCalledTimes(2),
  );
  const first = jest.mocked(service.confirmCommercialLead).mock.calls[0][1],
    second = jest.mocked(service.confirmCommercialLead).mock.calls[1][1];
  expect(second).toEqual(first);
  expect(second).toMatchObject({
    version: 3,
    expectedOrderUpdatedAt: order.updated_at,
  });
  expect(Object.keys(second).sort()).toEqual([
    "commandId",
    "expectedOrderUpdatedAt",
    "version",
  ]);
});
it("routes quotes to their own document and prevents new orders for pending Live checkouts", async () => {
  mockQuery = "leadId=lead-a";
  jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
    leadId: "lead-a",
    order: null,
    sources: [],
    quotationId: "quote-1",
    liveCheckoutId: null,
  });
  const view = await renderWorkspace();
  expect(
    await screen.findByRole("link", { name: "Abrir cotización" }),
  ).toHaveAttribute(
    "href",
    "/cotizaciones?quotationId=quote-1&fromLead=lead-a",
  );
  expect(
    screen.queryByRole("link", { name: "Preparar compra del Lead" }),
  ).not.toBeInTheDocument();
  view.unmount();
  jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
    leadId: "lead-a",
    order: null,
    sources: [],
    quotationId: null,
    liveCheckoutId: "checkout-1",
  });
  await renderWorkspace();
  await screen.findByText(/El checkout Live todavía/);
  expect(
    screen.queryByRole("link", { name: "Preparar compra del Lead" }),
  ).not.toBeInTheDocument();
  expect(service.confirmCommercialLead).not.toHaveBeenCalled();
});
it("notes keep the existing next action unless the user explicitly clears it", async () => {
  jest
    .mocked(service.getCommercialLead)
    .mockResolvedValue(lead({ nextActionAt: "2026-10-25T12:00:00Z" }));
  jest.mocked(service.addCommercialLeadActivity).mockResolvedValue(lead());
  await renderWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: "Ana feria" }));
  fireEvent.change(await screen.findByLabelText("Nota de seguimiento"), {
    target: { value: "Le interesa el producto" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar actividad" }));
  await waitFor(() =>
    expect(service.addCommercialLeadActivity).toHaveBeenCalledWith(
      "lead-a",
      expect.objectContaining({
        version: 3,
        kind: "NOTA",
        note: "Le interesa el producto",
        nextActionAt: undefined,
      }),
    ),
  );
});
it("never bootstraps types on read and preserves inactive catalogue entries", async () => {
  render(
    <LeadTypeCatalog
      types={[{ ...catalog, active: false }]}
      onChanged={jest.fn()}
    />,
  );
  expect(service.bootstrapCommercialLeadTypes).not.toHaveBeenCalled();
  expect(screen.getByText("Feria futura")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Activar Feria futura" }));
  await waitFor(() =>
    expect(service.updateCommercialLeadType).toHaveBeenCalledWith(
      "FERIA_FUTURA",
      { active: true },
    ),
  );
  expect(service.createCommercialLead).not.toHaveBeenCalled();
});

it("requires versioned reasons for loss and reopening without order mutations", async () => {
  jest
    .mocked(service.getCommercialLead)
    .mockResolvedValueOnce(lead())
    .mockResolvedValue(
      lead({ status: "PERDIDO", lostReason: "Cliente pospone", version: 4 }),
    );
  jest
    .mocked(service.loseCommercialLead)
    .mockResolvedValue(lead({ status: "PERDIDO", version: 4 }));
  jest
    .mocked(service.reopenCommercialLead)
    .mockResolvedValue(lead({ version: 5 }));
  await renderWorkspace();
  fireEvent.click(await screen.findByRole("button", { name: "Ana feria" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Marcar como perdido" }),
  );
  fireEvent.change(screen.getByLabelText("Motivo de pérdida"), {
    target: { value: "Cliente pospone" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar pérdida" }));
  await waitFor(() =>
    expect(service.loseCommercialLead).toHaveBeenCalledWith("lead-a", {
      version: 3,
      reason: "Cliente pospone",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Reabrir Lead" }));
  fireEvent.change(screen.getByLabelText("Motivo de reapertura"), {
    target: { value: "Retoma la compra" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar reapertura" }));
  await waitFor(() =>
    expect(service.reopenCommercialLead).toHaveBeenCalledWith("lead-a", {
      version: 4,
      reason: "Retoma la compra",
    }),
  );
  expect(service.confirmCommercialLead).not.toHaveBeenCalled();
});

it("shows direct prepaid web confirmation as closed history without repeating conversion", async () => {
  mockQuery = "leadId=lead-a";
  jest.mocked(service.getCommercialLead).mockResolvedValue(
    lead({
      status: "CONVERTIDO",
      confirmationBasis: "WEB_PREPAID",
      convertedOrderId: "order-a",
      confirmedAt: "2026-10-20T14:00:00Z",
    }),
  );
  jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
    leadId: "lead-a",
    order,
    sources: [],
    quotationId: null,
    liveCheckoutId: null,
  });
  await renderWorkspace();
  await screen.findByText("Compra confirmada");
  expect(
    screen.getByRole("link", { name: "Ver venta vinculada" }),
  ).toHaveAttribute("href", "/registrar-venta?orderId=order-a");
  expect(
    screen.queryByRole("button", { name: "Revisar y confirmar compra" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Marcar como perdido" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Editar contacto" }),
  ).not.toBeInTheDocument();
  expect(service.confirmCommercialLead).not.toHaveBeenCalled();
});

it("defaults to open Leads and sends either a status group or one explicit status", async () => {
  await renderWorkspace();
  await screen.findByText("Ana feria");
  expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
    expect.objectContaining({ statusGroup: "OPEN" }),
  );
  fireEvent.change(screen.getByLabelText("Estado comercial"), {
    target: { value: "CONVERTIDO" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "CONVERTIDO",
        statusGroup: undefined,
        page: 1,
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Estado comercial"), {
    target: { value: "ALL" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: undefined,
        statusGroup: undefined,
        page: 1,
      }),
    ),
  );
});

it("filters channel, ownership and follow-up on the server and resets pagination", async () => {
  jest
    .mocked(service.listCommercialLeads)
    .mockResolvedValue({ items: [lead()], total: 60, page: 1, limit: 25 });
  await renderWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Canal de origen"), {
    target: { value: "  Instagram  " },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialChannel: "Instagram", page: 1 }),
    ),
  );
  for (const assignment of ["MINE", "UNASSIGNED"]) {
    fireEvent.change(screen.getByLabelText("Responsable"), {
      target: { value: assignment },
    });
    await waitFor(() =>
      expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
        expect.objectContaining({
          assignment,
          assignedSellerId: undefined,
          page: 1,
        }),
      ),
    );
  }
  fireEvent.change(screen.getByLabelText("Estado comercial"), {
    target: { value: "PERDIDO" },
  });
  for (const followUp of ["OVERDUE", "TODAY", "UPCOMING", "NONE"]) {
    fireEvent.change(screen.getByLabelText("Seguimiento"), {
      target: { value: followUp },
    });
    await waitFor(() =>
      expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
        expect.objectContaining({
          followUp,
          status: undefined,
          statusGroup: "OPEN",
          page: 1,
        }),
      ),
    );
    expect(screen.getByLabelText("Estado comercial")).toHaveValue("OPEN");
  }
  fireEvent.change(screen.getByLabelText("Estado comercial"), {
    target: { value: "CLOSED" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ followUp: undefined, statusGroup: "CLOSED" }),
    ),
  );
  expect(screen.getByLabelText("Seguimiento")).toHaveValue("");
});

it("resets channel, ownership and follow-up when the selected store changes", async () => {
  const view = await renderWorkspace();
  fireEvent.change(screen.getByLabelText("Canal de origen"), {
    target: { value: "WhatsApp" },
  });
  fireEvent.change(screen.getByLabelText("Responsable"), {
    target: { value: "MINE" },
  });
  fireEvent.change(screen.getByLabelText("Seguimiento"), {
    target: { value: "OVERDUE" },
  });
  await waitFor(() =>
    expect(service.listCommercialLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialChannel: "WhatsApp",
        assignment: "MINE",
        followUp: "OVERDUE",
      }),
    ),
  );
  mockStoreId = "store-b";
  await act(async () => {
    view.rerender(<CommercialLeadsWorkspace />);
  });
  expect(screen.getByLabelText("Canal de origen")).toHaveValue("");
  expect(screen.getByLabelText("Responsable")).toHaveValue("");
  expect(screen.getByLabelText("Seguimiento")).toHaveValue("");
  expect(lastLeadFilters()).toMatchObject({
    storeId: "store-b",
    statusGroup: "OPEN",
    page: 1,
  });
  expect(lastLeadFilters().initialChannel).toBeUndefined();
  expect(lastLeadFilters().assignment).toBeUndefined();
  expect(lastLeadFilters().followUp).toBeUndefined();
});

function lastLeadFilters() {
  return jest.mocked(service.listCommercialLeads).mock.calls.at(-1)![0]!;
}

it("does not present a failed inbox read as zero Leads and can retry the same query", async () => {
  jest
    .mocked(service.listCommercialLeads)
    .mockRejectedValueOnce(new Error("La bandeja no está disponible"))
    .mockResolvedValueOnce({ items: [lead()], total: 1, page: 1, limit: 25 });
  await renderWorkspace();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "La bandeja no está disponible",
  );
  expect(screen.queryByText("0 oportunidades")).not.toBeInTheDocument();
  expect(
    screen.queryByText("No hay Leads para estos filtros"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Bandeja pendiente de actualizar"),
  ).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  });
  expect(screen.getByText("Ana feria")).toBeInTheDocument();
  expect(service.listCommercialLeads).toHaveBeenCalledTimes(2);
  expect(jest.mocked(service.listCommercialLeads).mock.calls[1][0]).toEqual(
    jest.mocked(service.listCommercialLeads).mock.calls[0][0],
  );
});

it("finishes a mutation after a concurrent detail refresh and notifies other commercial views once", async () => {
  let resolve!: (result: LeadDetail) => void;
  jest.mocked(service.addCommercialLeadActivity).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onChanged = jest.fn();
  const notifications: unknown[] = [];
  const listener = (event: Event) => {
    notifications.push((event as CustomEvent).detail);
  };
  window.addEventListener("commercial-leads:changed", listener);
  try {
    await renderDetail(onChanged);
    fireEvent.change(screen.getByLabelText("Nota de seguimiento"), {
      target: { value: "Cliente contactado" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Registrar seguimiento" }),
    );
    expect(service.addCommercialLeadActivity).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("commercial-leads:changed", {
          detail: { companyId: "company-a", leadId: "lead-a" },
        }),
      );
    });
    expect(service.getCommercialLead).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Registrar actividad" }),
    ).toBeDisabled();
    await act(async () => {
      resolve(lead());
    });
    expect(
      screen.getByRole("button", { name: "Registrar actividad" }),
    ).toBeEnabled();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(service.getCommercialLead).toHaveBeenCalledTimes(3);
    expect(notifications).toEqual([
      { companyId: "company-a", leadId: "lead-a" },
      { companyId: "company-a", leadId: undefined },
    ]);
  } finally {
    window.removeEventListener("commercial-leads:changed", listener);
  }
});

it("locks duplicate detail mutations and ignores callbacks after the detail unmounts", async () => {
  let resolve!: (result: LeadDetail) => void;
  jest.mocked(service.addCommercialLeadActivity).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onChanged = jest.fn();
  const view = await renderDetail(onChanged);
  fireEvent.change(screen.getByLabelText("Nota de seguimiento"), {
    target: { value: "Una sola gestión" },
  });
  const form = screen.getByRole("form", { name: "Registrar seguimiento" });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(service.addCommercialLeadActivity).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    resolve(lead());
  });
  expect(onChanged).not.toHaveBeenCalled();
  expect(service.getCommercialLead).toHaveBeenCalledTimes(1);
});

it("shows the recorded confirmer and activity actor without attributing another user's action to the current seller", async () => {
  jest.mocked(service.getCommercialLead).mockResolvedValue(
    lead({
      status: "CONVERTIDO",
      confirmedBy: "another-seller-id",
      activities: [
        {
          id: "activity-self",
          companyId: "company-a",
          leadId: "lead-a",
          actorId: "actor",
          kind: "NOTA",
          payload: { note: "Nota propia" },
          createdAt: "2026-10-20T12:00:00Z",
        },
        {
          id: "activity-other",
          companyId: "company-a",
          leadId: "lead-a",
          actorId: "another-seller-id",
          kind: "PURCHASE_CONFIRMED",
          payload: {},
          createdAt: "2026-10-20T12:01:00Z",
        },
      ],
    }),
  );
  await renderDetail();
  expect(screen.getByText("Confirmó: another-seller-id")).toBeInTheDocument();
  expect(screen.getByText(/· Tú$/)).toBeInTheDocument();
  expect(screen.getByText(/· another-seller-id$/)).toBeInTheDocument();
  expect(screen.queryByText("Confirmó: Tú")).not.toBeInTheDocument();
});

it.each([
  ["DEFERRED", "Reserva diferida: falta completar la información"],
  [
    "QUEUED",
    "Solicitud de reserva registrada. Espera la confirmación de inventario",
  ],
  ["PRESERVED", "Se conservan las reservas previas del pedido."],
  ["NOT_REQUIRED", "Este pedido contiene sólo servicios y no requiere inventario físico ni reserva."],
] as const)(
  "explains %s stock without declaring preparation complete",
  async (commercialStockState, message) => {
    jest.mocked(service.getCommercialLeadContext).mockResolvedValue({
      leadId: "lead-a",
      order: { ...order, commercialStockState },
      sources: [],
      quotationId: null,
      liveCheckoutId: null,
    });
    await renderDetail();
    expect(
      screen.getByText((content) => content.includes(message)),
    ).toBeInTheDocument();
  },
);
