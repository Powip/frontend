/**
 * Tests: emitir la guía de remisión remitente (FEAT-24 H12).
 *
 * 1. Venta (motivo 01): precarga destinatario, partida (ficha del almacén), llegada con el ubigeo
 *    resuelto e ítems NIU; emite y consulta el estado hasta que SUNAT acepta.
 * 2. Si la dirección no cruza con el catálogo INEI, obliga a elegir el ubigeo: sin él no se emite.
 * 3. Traslado (motivo 04): partida y llegada de las fichas de los dos almacenes, sin destinatario,
 *    con transporte privado.
 * 4. Transporte público y privado: sus validaciones se muestran antes de pedir número.
 * 5. Sin conexión con SUNAT (modo de pruebas): aviso de la empresa piloto y no se emite.
 * SUNAT nunca se llama: la API de ms-sunat está mockeada.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGreSettingsApi,
  getOrderForGreApi,
  getUbigeoApi,
  issueDespatchAdviceApi,
  listDespatchAdvicesApi,
  listUbigeoOptionsApi,
  refreshDespatchAdviceStatusApi,
  resolveUbigeoApi,
} from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import type { DespatchAdvice, GreSettings, UbigeoResolution } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { getWarehouseDetails, type WarehouseDetails } from "@/services/warehouseOpsService";
import { transfer } from "@/components/warehouse-ops/__tests__/fixtures";
import GreIssueDialog from "../GreIssueDialog";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1" } } }),
}));
jest.mock("@/lib/peruDate", () => ({ todayInPeru: () => "2026-11-18" }));
jest.mock("@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order", () => ({ useActiveTaxDocumentForOrder: () => null }));
jest.mock("@/services/warehouseOpsService", () => ({ getWarehouseDetails: jest.fn() }));
jest.mock("@/features/sunat/despatch-advice/api/despatch-advice.api", () => ({
  getGreSettingsApi: jest.fn(),
  getOrderForGreApi: jest.fn(),
  getUbigeoApi: jest.fn(),
  issueDespatchAdviceApi: jest.fn(),
  listDespatchAdvicesApi: jest.fn(),
  listAllDespatchAdvicesApi: jest.fn(),
  listUbigeoOptionsApi: jest.fn(),
  refreshDespatchAdviceStatusApi: jest.fn(),
  resolveUbigeoApi: jest.fn(),
  sendDespatchAdviceApi: jest.fn(),
}));

const SETTINGS: GreSettings = {
  sunatConnection: "OTHER",
  profiles: [
    {
      sunatProfileId: "p-1",
      ruc: "20111111111",
      razonSocial: "ACME S.A.C.",
      isDefault: true,
      isActive: true,
      configured: true,
      clientId: "cid",
      series: "T001",
      nextCorrelative: 5,
      updatedAt: null,
    },
  ],
};

const warehouseDetails = (overrides: Partial<WarehouseDetails>): WarehouseDetails => ({
  id: "w-1",
  name: "Central",
  type: "PROPIO",
  isMain: true,
  active: true,
  code: null,
  ubigeo: "150101",
  address: "Jr. Puno 890",
  contactName: null,
  contactPhone: null,
  sunatEstablishmentCode: "0001",
  ...overrides,
});

const ORDER = {
  id: "o-1",
  orderNumber: "ORD-1001",
  inventoryId: "w-1",
  customer: {
    fullName: "María Pérez",
    documentType: "DNI",
    documentNumber: "45678912",
    city: "Lima",
    province: "Lima",
    district: "Miraflores",
    address: "Av. Larco 123",
  },
  items: [{ sku: "POLO-M", productName: "Polo", quantity: 2 }],
};

const DISTRICTS: Record<string, string> = { "150101": "LIMA", "150122": "MIRAFLORES", "150141": "SURQUILLO" };

function advice(overrides: Partial<DespatchAdvice> = {}): DespatchAdvice {
  return {
    id: "gre-1",
    sunatProfileId: "p-1",
    rucIssuer: "20111111111",
    documentType: "09",
    series: "T001",
    correlative: "00000005",
    number: "T001-00000005",
    issueDate: "2026-11-18",
    issueTime: "10:00:00",
    transferReason: "01",
    transportMode: "01",
    externalReference: "ORD-1001",
    status: "SENT",
    ticket: "tk",
    ticketReceivedAt: null,
    sunatCode: null,
    sunatDescription: null,
    observations: [],
    qrUrl: null,
    hasSignedXml: true,
    hasCdr: false,
    sendAttempts: 1,
    lastError: null,
    payload: {} as DespatchAdvice["payload"],
    createdAt: "2026-11-18T15:00:00Z",
    updatedAt: "2026-11-18T15:00:00Z",
    ...overrides,
  };
}

function setup(source: Parameters<typeof GreIssueDialog>[0]["source"]) {
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GreIssueDialog source={source} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, user: userEvent.setup() };
}

const dialog = () => screen.findByRole("dialog");

function givenResolution(resolution: UbigeoResolution) {
  jest.mocked(resolveUbigeoApi).mockResolvedValue(resolution);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getGreSettingsApi).mockResolvedValue(SETTINGS);
  jest.mocked(getOrderForGreApi).mockResolvedValue(ORDER);
  jest.mocked(listDespatchAdvicesApi).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
  jest.mocked(getWarehouseDetails).mockImplementation(async (inventoryId: string) =>
    inventoryId === "w-2"
      ? warehouseDetails({ id: "w-2", name: "Tienda Sur", ubigeo: "150141", address: "Av. Benavides 500", sunatEstablishmentCode: "0002" })
      : warehouseDetails({}),
  );
  jest.mocked(getUbigeoApi).mockImplementation(async (code: string) => {
    if (!DISTRICTS[code]) throw Object.assign(new Error("not found"), { response: { status: 404, data: { code: "UBIGEO_NOT_FOUND" } } });
    return { ubigeo: code, department: "LIMA", province: "LIMA METROPOLITANA", district: DISTRICTS[code] };
  });
  jest.mocked(listUbigeoOptionsApi).mockImplementation(async (parent: string) => {
    if (!parent) return { parent: null, level: "DEPARTMENT", items: [{ code: "04", name: "AREQUIPA" }, { code: "15", name: "LIMA" }] };
    if (parent === "15") return { parent, level: "PROVINCE", items: [{ code: "1501", name: "LIMA METROPOLITANA" }] };
    return { parent, level: "DISTRICT", items: Object.entries(DISTRICTS).map(([code, name]) => ({ code, name })) };
  });
});

async function fillPublicCarrier(user: ReturnType<typeof userEvent.setup>, scope: HTMLElement) {
  await user.type(within(scope).getByLabelText("RUC del transportista"), "20100070970");
  await user.type(within(scope).getByLabelText("Razón social del transportista"), "Olva Courier S.A.C.");
  await user.type(within(scope).getByLabelText("Peso bruto (kg)"), "1.5");
}

describe("GreIssueDialog", () => {
  it("venta: precarga el pedido, resuelve el ubigeo de llegada, emite y consulta el estado", async () => {
    givenResolution({ resolved: true, ubigeo: "150122", department: "LIMA", province: "LIMA METROPOLITANA", district: "MIRAFLORES" });
    jest.mocked(issueDespatchAdviceApi).mockResolvedValue(advice({ status: "SENT" }));
    jest.mocked(refreshDespatchAdviceStatusApi).mockResolvedValue(advice({ status: "ACCEPTED", hasCdr: true }));
    const { user } = setup({ kind: "order", orderId: "o-1" });
    const scope = await dialog();

    expect(await within(scope).findByLabelText("Nombre o razón social")).toHaveValue("María Pérez");
    expect(within(scope).getByLabelText("Número de documento")).toHaveValue("45678912");
    expect(within(scope).getByLabelText("Dirección de partida")).toHaveValue("Jr. Puno 890");
    expect(within(scope).getByLabelText("Dirección de llegada")).toHaveValue("Av. Larco 123");
    expect(within(scope).getByText(/Punto de partida · Central/)).toBeInTheDocument();
    expect(await within(scope).findByText("MIRAFLORES")).toBeInTheDocument();
    expect(within(scope).getByText("POLO-M")).toBeInTheDocument();
    expect(resolveUbigeoApi).toHaveBeenCalledWith({ department: "Lima", province: "Lima", district: "Miraflores" }, expect.anything());

    await fillPublicCarrier(user, scope);
    await user.click(within(scope).getByRole("button", { name: "Emitir guía" }));

    await waitFor(() => expect(issueDespatchAdviceApi).toHaveBeenCalledTimes(1));
    expect(jest.mocked(issueDespatchAdviceApi).mock.calls[0][0]).toMatchObject({
      sunatProfileId: "p-1",
      externalReference: "ORD-1001",
      transferReason: "01",
      transportMode: "01",
      grossWeightKg: 1.5,
      packageCount: 1,
      recipient: { identityDocumentType: "1", identityDocumentNumber: "45678912", name: "María Pérez" },
      origin: { ubigeo: "150101", address: "Jr. Puno 890", establishmentCode: "0001" },
      destination: { ubigeo: "150122", address: "Av. Larco 123" },
      carrier: { ruc: "20100070970", name: "Olva Courier S.A.C." },
      items: [{ unitCode: "NIU", quantity: 2, code: "POLO-M" }],
    });
    expect(await within(scope).findByText("SUNAT aceptó la guía T001-00000005")).toBeInTheDocument();
    expect(refreshDespatchAdviceStatusApi).toHaveBeenCalledWith("gre-1");
  });

  it("si la dirección no cruza con el catálogo INEI, obliga a elegir el ubigeo antes de emitir", async () => {
    givenResolution({ resolved: false, department: "LIMA", province: null, reason: "PROVINCE_NOT_FOUND" });
    jest.mocked(issueDespatchAdviceApi).mockResolvedValue(advice({ status: "ACCEPTED" }));
    const { user } = setup({ kind: "order", orderId: "o-1" });
    const scope = await dialog();

    expect(await within(scope).findByText(/no cruza con el catálogo INEI/)).toBeInTheDocument();
    await waitFor(() => expect(within(scope).getByLabelText("Ubigeo de llegada: departamento")).toHaveValue("15"));

    await fillPublicCarrier(user, scope);
    await user.click(within(scope).getByRole("button", { name: "Emitir guía" }));
    expect(within(scope).getByText("Elige departamento, provincia y distrito del punto de llegada.")).toBeInTheDocument();
    expect(issueDespatchAdviceApi).not.toHaveBeenCalled();

    await user.selectOptions(within(scope).getByLabelText("Ubigeo de llegada: provincia"), "1501");
    await waitFor(() => expect(within(scope).getByRole("option", { name: "MIRAFLORES" })).toBeInTheDocument());
    await user.selectOptions(within(scope).getByLabelText("Ubigeo de llegada: distrito"), "150122");
    await user.click(within(scope).getByRole("button", { name: "Emitir guía" }));

    await waitFor(() => expect(issueDespatchAdviceApi).toHaveBeenCalledTimes(1));
    expect(jest.mocked(issueDespatchAdviceApi).mock.calls[0][0].destination).toEqual({ ubigeo: "150122", address: "Av. Larco 123" });
  });

  it("traslado (motivo 04): fichas de los dos almacenes, sin destinatario y con transporte privado", async () => {
    jest.mocked(issueDespatchAdviceApi).mockResolvedValue(advice({ status: "ACCEPTED", transferReason: "04", externalReference: "TR-0001" }));
    const { user } = setup({ kind: "transfer", transfer: transfer({ status: "en_camino" }), originName: "Central", destinationName: "Tienda Sur" });
    const scope = await dialog();

    expect(await within(scope).findByText(/el destinatario es tu propia empresa/)).toBeInTheDocument();
    expect(within(scope).queryByLabelText("Nombre o razón social")).not.toBeInTheDocument();
    expect(within(scope).getByLabelText("Dirección de llegada")).toHaveValue("Av. Benavides 500");

    await user.click(within(scope).getByRole("button", { name: /02 · Transporte privado/ }));
    await user.type(within(scope).getByLabelText("Placa del vehículo"), "abc-123");
    await user.type(within(scope).getByLabelText("Licencia del conductor"), "Q12345678");
    await user.type(within(scope).getByLabelText("Número de documento del conductor"), "12345678");
    await user.type(within(scope).getByLabelText("Nombres del conductor"), "Juan");
    await user.type(within(scope).getByLabelText("Apellidos del conductor"), "Quispe");
    await user.type(within(scope).getByLabelText("Peso bruto (kg)"), "3");
    await user.click(within(scope).getByRole("button", { name: "Emitir guía" }));

    await waitFor(() => expect(issueDespatchAdviceApi).toHaveBeenCalledTimes(1));
    const body = jest.mocked(issueDespatchAdviceApi).mock.calls[0][0];
    expect(body).toMatchObject({
      transferReason: "04",
      transportMode: "02",
      externalReference: "TR-0001",
      origin: { ubigeo: "150101", address: "Jr. Puno 890", establishmentCode: "0001" },
      destination: { ubigeo: "150141", address: "Av. Benavides 500", establishmentCode: "0002" },
      vehicle: { plate: "ABC123" },
      drivers: [{ identityDocumentType: "1", identityDocumentNumber: "12345678", firstName: "Juan", familyName: "Quispe", licenseNumber: "Q12345678" }],
    });
    expect(body.recipient).toBeUndefined();
    expect(body.carrier).toBeUndefined();
    expect(body.items).toEqual([
      { description: "Polo", quantity: 2, unitCode: "NIU", code: "POLO" },
      { description: "Gorra", quantity: 1, unitCode: "NIU", code: "GORRA" },
    ]);
    expect(await within(scope).findByText("SUNAT aceptó la guía T001-00000005")).toBeInTheDocument();
  });

  it("valida el transporte público y el privado antes de pedir número", async () => {
    givenResolution({ resolved: true, ubigeo: "150122", department: "LIMA", province: "LIMA METROPOLITANA", district: "MIRAFLORES" });
    const { user } = setup({ kind: "order", orderId: "o-1" });
    const scope = await dialog();
    await within(scope).findByText("MIRAFLORES");

    await user.type(within(scope).getByLabelText("RUC del transportista"), "20111111111");
    await user.type(within(scope).getByLabelText("Peso bruto (kg)"), "1");
    await user.click(within(scope).getByRole("button", { name: "Emitir guía" }));
    expect(within(scope).getByText(/el transportista no puede ser tu propio RUC/)).toBeInTheDocument();
    expect(within(scope).getByText("Ingresa la razón social del transportista.")).toBeInTheDocument();

    await user.click(within(scope).getByRole("button", { name: /02 · Transporte privado/ }));
    expect(within(scope).getByText(/La placa tiene de 6 a 8 letras o números/)).toBeInTheDocument();
    expect(within(scope).getByText(/La licencia de conducir tiene 9 o 10/)).toBeInTheDocument();
    expect(within(scope).getByText("Ingresa los nombres del conductor.")).toBeInTheDocument();
    await user.type(within(scope).getByLabelText("Placa del vehículo"), "AB-1");
    expect(within(scope).getByText(/La placa tiene de 6 a 8 letras o números/)).toBeInTheDocument();
    expect(issueDespatchAdviceApi).not.toHaveBeenCalled();
  });

  it("sin conexión con SUNAT avisa que la emisión real se habilita con la empresa piloto y no emite", async () => {
    jest.mocked(getGreSettingsApi).mockResolvedValue({ ...SETTINGS, sunatConnection: "NOT_CONFIGURED" });
    givenResolution({ resolved: true, ubigeo: "150122", department: "LIMA", province: "LIMA METROPOLITANA", district: "MIRAFLORES" });
    setup({ kind: "order", orderId: "o-1" });
    const scope = await dialog();

    expect(await within(scope).findByTestId("gre-mode-banner")).toHaveTextContent("La emisión real de guías de remisión se habilita con la empresa piloto.");
    expect(within(scope).getByRole("button", { name: "Emitir guía" })).toBeDisabled();
  });
});
