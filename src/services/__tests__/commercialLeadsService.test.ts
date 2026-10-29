import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { CreateLeadInput, Lead, LeadCapabilities, LeadType } from "@/types/leads";
import {
  addCommercialLeadActivity,
  bootstrapCommercialLeadTypes,
  commercialLeadError,
  confirmCommercialLead,
  confirmCommercialOrderPurchase,
  createCommercialLead,
  createCommercialLeadType,
  getCommercialLead,
  getCommercialLeadCapabilities,
  getCommercialLeadConfirmationCapabilities,
  listCommercialLeads,
  listCommercialLeadTypes,
  loseCommercialLead,
  reopenCommercialLead,
  updateCommercialLead,
  updateCommercialLeadType,
} from "../commercialLeadsService";

jest.mock("axios", () => ({
  __esModule: true,
  default: { isAxiosError: jest.fn(), get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const BASE = `${GATEWAY.ventas}/leads`;
const captureId = "de219eb6-58e8-4730-934c-a7a34d45b52e";
const leadType: LeadType = {
  companyId: "company-a",
  code: "EVENTO_LOCAL",
  name: "Evento local",
  active: true,
  fields: [{ key: "eventDate", label: "Fecha del evento", type: "date", required: true }],
  schemaVersion: 1,
};
const lead: Lead = {
  id: "lead-a",
  companyId: "company-a",
  storeId: null,
  typeCode: "EVENTO_LOCAL",
  type: leadType,
  status: "NUEVO",
  contactName: "Ana",
  contactPhone: null,
  contactEmail: null,
  initialChannel: null,
  createdBy: "seller-a",
  assignedSellerId: null,
  receivedAt: "2026-10-20T15:00:00.000Z",
  sourceCreatedAt: null,
  estimatedAmount: null,
  currency: null,
  customFields: { eventDate: "2026-10-25" },
  version: 1,
  lostReason: null,
  nextActionAt: null,
  legacyOrderId: null,
  convertedOrderId: null,
  confirmedAt: null,
  confirmedBy: null,
  confirmationBasis: null,
  conversionCommandId: null,
  conversionSnapshot: null,
  createdAt: "2026-10-20T15:00:00.000Z",
  updatedAt: "2026-10-20T15:00:00.000Z",
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(axios.isAxiosError).mockReturnValue(false);
});

afterEach(() => {
  // The browser never creates orders, payments or stock through a parallel route.
  for (const method of [axiosAuth.get, axiosAuth.post, axiosAuth.patch]) {
    for (const [url] of jest.mocked(method).mock.calls) {
      expect(url).toMatch(/\/ventas\/leads(?:\/|$)/);
      expect(url).not.toMatch(/order-header|payments|stock/);
    }
  }
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.patch).not.toHaveBeenCalled();
});

it("reads disabled capabilities without activating or bootstrapping the module", async () => {
  const capabilities: LeadCapabilities = {
    enabled: false,
    phase: "foundation",
    canView: false,
    canManage: false,
    canManageTypes: false,
  };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: capabilities });

  await expect(getCommercialLeadCapabilities()).resolves.toBe(capabilities);

  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/capabilities`);
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  expect(axiosAuth.post).not.toHaveBeenCalled();
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});

it("reads confirmation capabilities independently without changing foundation capabilities", async () => {
  const capabilities = { enabled: true, canConfirm: false };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: capabilities });

  await expect(getCommercialLeadConfirmationCapabilities()).resolves.toBe(capabilities);

  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/confirmation-capabilities`);
  expect(axiosAuth.post).not.toHaveBeenCalled();
});

it("passes store, type, state, search, dates and pagination without inventing scope", async () => {
  const response = { items: [lead], total: 21, page: 2, limit: 20 };
  const params = {
    storeId: "store-a",
    status: "SEGUIMIENTO" as const,
    typeCode: "EVENTO_LOCAL",
    search: "Ana + amiga",
    fromDate: "2026-10-01",
    toDate: "2026-10-20",
    page: 2,
    limit: 20,
  };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: response });

  await expect(listCommercialLeads(params)).resolves.toBe(response);

  expect(axiosAuth.get).toHaveBeenCalledWith(BASE, { params });
  expect(params).not.toHaveProperty("companyId");
  expect(axiosAuth.post).not.toHaveBeenCalled();
});

it("leaves an omitted store to the authenticated backend instead of selecting a default", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } });

  await listCommercialLeads();

  expect(axiosAuth.get).toHaveBeenCalledWith(BASE, { params: {} });
});

it("encodes the lead path and preserves numeric strings, unknown fields and activities", async () => {
  const detail = {
    ...lead,
    estimatedAmount: "9999999999.99",
    customFields: { eventDate: "2026-10-25", futureField: false },
    activities: [{
      id: "activity-a",
      companyId: "company-a",
      leadId: lead.id,
      actorId: "seller-a",
      kind: "NOTA",
      payload: { note: "Consulta inicial", previousStatus: "NUEVO" },
      createdAt: "2026-10-20T15:00:00.000Z",
    }],
  };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: detail });

  await expect(getCommercialLead("lead/a ?#")).resolves.toBe(detail);

  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/lead%2Fa%20%3F%23`);
});

it("lists types without bootstrapping and only initializes them through the explicit setup action", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [leadType] });
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: [leadType] });

  await expect(listCommercialLeadTypes()).resolves.toEqual([leadType]);
  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/types`);
  expect(axiosAuth.post).not.toHaveBeenCalled();

  await expect(bootstrapCommercialLeadTypes()).resolves.toEqual([leadType]);
  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/types/bootstrap`, {});
});

it("supports custom type codes and fields without restricting capture to the initial types", async () => {
  const input = {
    code: "EVENTO_LOCAL",
    name: "Evento local",
    fields: leadType.fields,
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: leadType });

  await expect(createCommercialLeadType(input)).resolves.toBe(leadType);

  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/types`, input);
});

it("encodes type paths and only sends the requested name or active change", async () => {
  const updated = { ...leadType, active: false };
  jest.mocked(axiosAuth.patch).mockResolvedValue({ data: updated });

  await expect(updateCommercialLeadType("EVENTO/LOCAL ?", { active: false })).resolves.toBe(updated);

  expect(axiosAuth.patch).toHaveBeenCalledWith(`${BASE}/types/EVENTO%2FLOCAL%20%3F`, { active: false });
});

it("captures source identity, original timestamp and zero estimate without creating a sale", async () => {
  const input: CreateLeadInput = {
    captureId,
    typeCode: "EVENTO_LOCAL",
    storeId: "store-a",
    contactName: "Ana",
    contactPhone: "999222333",
    contactEmail: "ana@example.test",
    initialChannel: "INSTAGRAM",
    estimatedAmount: 0,
    currency: "PEN",
    customFields: { eventDate: "2026-10-25", subscribed: false },
    sourceCreatedAt: "2026-10-19T23:15:00.000Z",
    source: {
      provider: "future_crm",
      instanceId: "instance/a",
      objectType: "conversation",
      externalId: "conversation/123",
      kind: "IDENTITY",
    },
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { ...lead, estimatedAmount: "0.00" } });

  await expect(createCommercialLead(input)).resolves.toMatchObject({ estimatedAmount: "0.00" });

  expect(axiosAuth.post).toHaveBeenCalledWith(BASE, input);
  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
});

it("preserves the caller's captureId on retry and leaves unknown amounts omitted", async () => {
  const input: CreateLeadInput = { captureId, typeCode: "WHATSAPP_CRM", contactPhone: "999222333" };
  const failure = new Error("La respuesta no llegó");
  jest.mocked(axiosAuth.post)
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce({ data: lead });

  await expect(createCommercialLead(input)).rejects.toBe(failure);
  await expect(createCommercialLead(input)).resolves.toBe(lead);

  expect(axiosAuth.post).toHaveBeenNthCalledWith(1, BASE, input);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(2, BASE, input);
  expect(input).not.toHaveProperty("estimatedAmount");
  expect(input).not.toHaveProperty("storeId");
});

it("preserves nullable capture fields without filling in a store, amount or currency", async () => {
  const input: CreateLeadInput = {
    captureId,
    typeCode: "MANUAL",
    contactName: "Ana",
    contactPhone: null,
    contactEmail: null,
    storeId: null,
    initialChannel: null,
    estimatedAmount: null,
    currency: null,
    sourceCreatedAt: null,
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: lead });

  await expect(createCommercialLead(input)).resolves.toBe(lead);

  expect(axiosAuth.post).toHaveBeenCalledWith(BASE, input);
});

it("updates versioned fields and passes explicit clears without inventing confirmation", async () => {
  const input = {
    version: 4,
    contactName: "Ana María",
    contactPhone: null,
    estimatedAmount: null,
    currency: null,
    customFields: { interested: true },
    nextActionAt: null,
  };
  jest.mocked(axiosAuth.patch).mockResolvedValue({ data: { ...lead, version: 5 } });

  await expect(updateCommercialLead("lead/a", input)).resolves.toMatchObject({ version: 5 });

  expect(axiosAuth.patch).toHaveBeenCalledWith(`${BASE}/lead%2Fa`, input);
});

it.each(["CONTACTADO", "SEGUIMIENTO", "NOTA"] as const)("records %s as a versioned activity", async (kind) => {
  const input = {
    version: 2,
    kind,
    note: "Volver a contactar",
    nextActionAt: "2026-10-21T15:00:00.000Z",
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { ...lead, version: 3 } });

  await expect(addCommercialLeadActivity("lead/a", input)).resolves.toMatchObject({ version: 3 });

  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/lead%2Fa/activities`, input);
});

it("loses and reopens an opportunity with a reason and version rather than cancelling a sale", async () => {
  const loss = { version: 2, reason: "Decidió no comprar" };
  const reopening = { version: 3, reason: "Solicitó retomar la propuesta" };
  jest.mocked(axiosAuth.post)
    .mockResolvedValueOnce({ data: { ...lead, status: "PERDIDO", version: 3 } })
    .mockResolvedValueOnce({ data: { ...lead, status: "NUEVO", version: 4 } });

  await expect(loseCommercialLead("lead/a", loss)).resolves.toMatchObject({ status: "PERDIDO" });
  await expect(reopenCommercialLead("lead/a", reopening)).resolves.toMatchObject({ status: "NUEVO" });

  expect(axiosAuth.post).toHaveBeenNthCalledWith(1, `${BASE}/lead%2Fa/lose`, loss);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(2, `${BASE}/lead%2Fa/reopen`, reopening);
});

it.each([403, 404, 409, 503])("preserves the backend %s failure without retrying or masking it", async (status) => {
  const failure = { response: { status, data: { message: "Acción rechazada" } } };
  jest.mocked(axiosAuth.patch).mockRejectedValue(failure);

  await expect(updateCommercialLead("lead-a", { version: 1, contactName: "Ana" })).rejects.toBe(failure);

  expect(axiosAuth.patch).toHaveBeenCalledTimes(1);
  expect(axiosAuth.post).not.toHaveBeenCalled();
});

it("formats backend validation errors consistently with other authenticated services", () => {
  jest.mocked(axios.isAxiosError).mockReturnValue(true);
  expect(commercialLeadError({ response: { data: { message: ["Tipo inválido", "Falta versión"] } } }))
    .toBe("Tipo inválido. Falta versión");
  expect(commercialLeadError({ response: { data: { message: "No tienes permiso" } } }))
    .toBe("No tienes permiso");
});

it("keeps network errors readable and provides a fallback for unknown failures", () => {
  expect(commercialLeadError(new Error("Sin conexión"))).toBe("Sin conexión");
  expect(commercialLeadError(null)).toBe("No se pudo completar la acción. Intenta de nuevo.");
});

it("confirms through the canonical command without issuing a separate sale request", async () => {
  const input = {
    commandId: "2c9afce5-1cec-4a05-b2e1-cd6a8e8c023a",
    version: 4,
    order: { storeId: "store-a", items: [{ productVariantId: "variant-a", quantity: 2, unitPrice: 35 }] },
  };
  const result = {
    lead: { ...lead, status: "CONVERTIDO", version: 5 },
    order: { id: "order-a", orderNumber: "ORD-100", status: "PENDIENTE" },
    replayed: false,
  };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: result });

  await expect(confirmCommercialLead("lead/a", input)).resolves.toBe(result);

  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/lead%2Fa/confirm-purchase`, input);
  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});

it("retries confirmation with the same command, selection and version and preserves replay metadata", async () => {
  const input = { commandId: "2c9afce5-1cec-4a05-b2e1-cd6a8e8c023a", version: 4 };
  const response = { lead, order: { id: "order-a" }, replayed: true };
  const timeout = new Error("Respuesta interrumpida");
  jest.mocked(axiosAuth.post).mockRejectedValueOnce(timeout).mockResolvedValueOnce({ data: response });

  await expect(confirmCommercialLead("lead-a", input)).rejects.toBe(timeout);
  await expect(confirmCommercialLead("lead-a", input)).resolves.toBe(response);

  expect(axiosAuth.post).toHaveBeenNthCalledWith(1, `${BASE}/lead-a/confirm-purchase`, input);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(2, `${BASE}/lead-a/confirm-purchase`, input);
  expect(input).not.toHaveProperty("order");
});

it("does not bypass a rejected confirmation with an ordinary order creation", async () => {
  const conflict = { response: { status: 409, data: { message: "La selección cambió" } } };
  jest.mocked(axiosAuth.post).mockRejectedValue(conflict);

  await expect(confirmCommercialLead("lead-a", { commandId: captureId, version: 1 })).rejects.toBe(conflict);

  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});

it("confirms the encoded existing order through the canonical command with its reviewed snapshot", async () => {
  const input = {
    commandId: captureId,
    leadId: "lead-a",
    version: 4,
    expectedOrderUpdatedAt: "2026-10-22T22:23:53.000Z",
  };
  const result = { lead, order: { id: "order/a", commercialStage: "SALE" }, replayed: false };
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: result });

  await expect(confirmCommercialOrderPurchase("order/a", input)).resolves.toBe(result);

  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/from-order/order%2Fa/confirm-purchase`, input);
  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});

it("retries an existing order confirmation with the same command and reviewed snapshot", async () => {
  const input = Object.freeze({
    commandId: captureId,
    leadId: "lead-a",
    version: 4,
    expectedOrderUpdatedAt: "2026-10-22T22:23:53.000Z",
  });
  const response = { lead, order: { id: "order-a" }, replayed: true };
  const timeout = new Error("Respuesta interrumpida");
  jest.mocked(axiosAuth.post).mockRejectedValueOnce(timeout).mockResolvedValueOnce({ data: response });

  await expect(confirmCommercialOrderPurchase("order-a", input)).rejects.toBe(timeout);
  await expect(confirmCommercialOrderPurchase("order-a", input)).resolves.toBe(response);

  expect(axiosAuth.post).toHaveBeenCalledTimes(2);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(1, `${BASE}/from-order/order-a/confirm-purchase`, input);
  expect(axiosAuth.post).toHaveBeenNthCalledWith(2, `${BASE}/from-order/order-a/confirm-purchase`, input);
  expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toBe(input);
  expect(jest.mocked(axiosAuth.post).mock.calls[1][1]).toBe(input);
});

it.each([403, 404, 409, 503])("preserves an existing order confirmation failure %s without an alternative mutation", async (status) => {
  const failure = { response: { status, data: { message: "Confirmación rechazada" } } };
  jest.mocked(axiosAuth.post).mockRejectedValue(failure);

  await expect(confirmCommercialOrderPurchase("order-a", { commandId: captureId })).rejects.toBe(failure);

  expect(axiosAuth.post).toHaveBeenCalledTimes(1);
  expect(axiosAuth.post).toHaveBeenCalledWith(`${BASE}/from-order/order-a/confirm-purchase`, { commandId: captureId });
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});
