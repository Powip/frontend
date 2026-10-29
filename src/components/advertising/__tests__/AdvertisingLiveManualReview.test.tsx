import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AdvertisingLocalManualRecord,
  AdvertisingManualImportPreview,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import {
  AdvertisingApiError,
  getAdvertisingManualAudit,
  importAdvertisingManualRecords,
  previewAdvertisingManualImport,
  previewAdvertisingManualResolution,
  resolveAdvertisingManualRecord,
} from "@/services/advertisingService";
import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { AdvertisingLiveManualReview } from "../AdvertisingLiveManualReview";
import { AdvertisingManualImportDialog } from "../AdvertisingManualImportDialog";
import { readAdvertisingLocalRecords } from "../advertising-local-records";

jest.mock("@/services/advertisingService", () => ({
  ...jest.requireActual("@/services/advertisingService"),
  getAdvertisingManualAudit: jest.fn(),
  importAdvertisingManualRecords: jest.fn(),
  previewAdvertisingManualImport: jest.fn(),
  previewAdvertisingManualResolution: jest.fn(),
  resolveAdvertisingManualRecord: jest.fn(),
}));
jest.mock("../advertising-local-records", () => ({ readAdvertisingLocalRecords: jest.fn() }));

const previewResolution = jest.mocked(previewAdvertisingManualResolution);
const resolveRecord = jest.mocked(resolveAdvertisingManualRecord);
const previewImport = jest.mocked(previewAdvertisingManualImport);
const importRecords = jest.mocked(importAdvertisingManualRecords);
const readLocal = jest.mocked(readAdvertisingLocalRecords);
const audit = jest.mocked(getAdvertisingManualAudit);

beforeAll(() => {
  if (!window.PointerEvent)
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: jest.fn(),
  });
  if (!window.ResizeObserver)
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
});

function wire(): AdvertisingSnapshotWire {
  return {
    accounts: [
      {
        id: "account-pen",
        provider: "meta",
        externalId: "123",
        name: "Lima",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        connectionId: null,
        syncFrom: null,
        lastAttemptAt: null,
        lastSuccessfulAt: null,
        updatedAt: null,
      },
      {
        id: "account-usd",
        provider: "meta",
        externalId: "456",
        name: "Global",
        currency: "USD",
        timeZone: "America/New_York",
        enabled: true,
        connectionId: null,
        syncFrom: null,
        lastAttemptAt: null,
        lastSuccessfulAt: null,
        updatedAt: null,
      },
    ],
    days: [],
    manualRecords: [
      {
        id: "record-id",
        source: "pauta",
        sourceId: "original-id",
        browserKey: "browser-id",
        date: "2026-10-09",
        amount: "100.50",
        currency: null,
        classificationCurrency: null,
        importedAccountId: null,
        exclusionKind: null,
        status: "pending",
        resolutionVersion: 0,
        updatedAt: null,
      },
    ],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: false, status: "disconnected" },
    },
    capabilities: { canManage: false, canReconcile: true },
    today: "2026-10-09",
  };
}

function effective(amount = "100.50", pendingManualCount = 1): EffectiveAdvertisingSpendWire {
  return {
    scope: "company",
    from: "2026-10-09",
    to: "2026-10-09",
    rows: [],
    totals: [
      {
        currency: "PEN",
        amount,
        importedAmount: "100.50",
        fallbackAmount: "0",
        additionalAmount: "0",
        coverage: "complete",
        missingAccountDays: 0,
        provisional: false,
      },
    ],
    pendingManualCount,
    representedManualCount: pendingManualCount ? 0 : 1,
    excludedManualCount: 0,
    conflictedManualIds: [],
  };
}

function localRecord(
  sourceId: string,
  source: "pauta" | "cierre" = "pauta",
): AdvertisingLocalManualRecord {
  return {
    source,
    sourceId,
    browserKey: "browser-id",
    date: "2026-10-09",
    amount: "100.50",
    currency: null,
    payload:
      source === "pauta"
        ? { original: { canalId: "WhatsApp", monto: "100.50" } }
        : { storeId: "store-1", platform: "meta", original: { publiMeta: "100.50" } },
  };
}

function importResult(
  records: AdvertisingLocalManualRecord[],
  conflictId?: string,
): AdvertisingManualImportPreview {
  const entries = records.map(({ payload: _payload, ...record }) => ({
    ...record,
    state: record.sourceId === conflictId ? ("conflict" as const) : ("new" as const),
  }));
  return {
    entries,
    counts: {
      new: records.length - (conflictId ? 1 : 0),
      conflict: conflictId ? 1 : 0,
      existing: 0,
      total: records.length,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  readLocal.mockReturnValue({
    records: [localRecord("original-id")],
    warnings: [],
    nextOffset: null,
  });
  previewResolution.mockResolvedValue({
    recordId: "record-id",
    expectedVersion: 0,
    before: effective(),
    after: effective("100.50", 0),
    beforeStatus: "pending",
    afterStatus: "represented",
  });
  resolveRecord.mockResolvedValue({
    record: { ...wire().manualRecords[0], status: "represented", resolutionVersion: 1 },
  });
  audit.mockResolvedValue({ entries: [] });
  previewImport.mockImplementation(async (_token, _company, records) => importResult(records));
  importRecords.mockImplementation(async (_token, _company, records) => importResult(records));
});

async function select(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string | RegExp,
) {
  screen.getByRole("combobox", { name: label }).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: option }));
}

async function configureRepresented(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Revisar registro" }));
  await select(user, "¿Qué representa?", "Ya incluido en el importado");
  expect(screen.getByRole("combobox", { name: "Confirma la moneda" })).toHaveTextContent(
    "Sin moneda seleccionada",
  );
  await select(user, "Confirma la moneda", "PEN");
  await select(user, "Cuenta y día del consumo", /Lima · PEN/);
  await user.click(
    screen.getByRole("checkbox", {
      name: "Corresponde al consumo importado de esta cuenta y día.",
    }),
  );
  await user.type(screen.getByRole("textbox", { name: "Motivo" }), "Mismo consumo confirmado");
}

it("requires explicit currency/account/meaning and a real before/after preview before resolving", async () => {
  const user = userEvent.setup();
  const changed = jest.fn().mockResolvedValue(undefined);
  render(
    <AdvertisingLiveManualReview
      wire={wire()}
      companyId="company-id"
      token="test-token"
      storeIds={[]}
      canReconcile
      onChanged={changed}
    />,
  );
  await configureRepresented(user);
  expect(resolveRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Ver antes y después" }));
  expect(await screen.findByText(/Gasto efectivo de la empresa/)).toHaveTextContent("9 oct");
  expect(previewResolution).toHaveBeenCalledWith(
    "test-token",
    "company-id",
    "record-id",
    {
      action: "represented",
      accountId: "account-pen",
      currency: "PEN",
      expectedVersion: 0,
      reason: "Mismo consumo confirmado",
    },
    expect.any(AbortSignal),
  );
  expect(resolveRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Guardar revisión" }));
  await waitFor(() => expect(resolveRecord).toHaveBeenCalledTimes(1));
  expect(resolveRecord).toHaveBeenCalledWith("test-token", "company-id", "record-id", {
    action: "represented",
    accountId: "account-pen",
    currency: "PEN",
    expectedVersion: 0,
    reason: "Mismo consumo confirmado",
  });
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
});

it("allows unknown amounts to be excluded as payments without assigning currency or creating consumption", async () => {
  const data = wire();
  data.manualRecords[0].amount = null;
  previewResolution.mockResolvedValueOnce({
    recordId: "record-id",
    expectedVersion: 0,
    before: effective(),
    after: { ...effective(), pendingManualCount: 0, excludedManualCount: 1 },
    beforeStatus: "pending",
    afterStatus: "excluded",
  });
  resolveRecord.mockResolvedValueOnce({
    record: {
      ...data.manualRecords[0],
      status: "excluded",
      exclusionKind: "payment",
      resolutionVersion: 1,
    },
  });
  const user = userEvent.setup();
  render(
    <AdvertisingLiveManualReview
      wire={data}
      companyId="company-id"
      token="test-token"
      storeIds={[]}
      canReconcile
      onChanged={jest.fn().mockResolvedValue(undefined)}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Revisar registro" }));
  await select(user, "¿Qué representa?", "No es consumo de anuncios");
  await select(user, "Tipo de registro", "Pago");
  await user.click(
    screen.getByRole("checkbox", { name: "Confirmo que no es consumo de anuncios." }),
  );
  await user.type(screen.getByRole("textbox", { name: "Motivo" }), "Pago de factura");
  await user.click(screen.getByRole("button", { name: "Ver antes y después" }));
  await screen.findByRole("button", { name: "Guardar revisión" });
  expect(previewResolution.mock.calls[0][3]).toEqual({
    action: "excluded",
    exclusionKind: "payment",
    expectedVersion: 0,
    reason: "Pago de factura",
  });
  await user.click(screen.getByRole("button", { name: "Guardar revisión" }));
  await waitFor(() => expect(resolveRecord).toHaveBeenCalledTimes(1));
  expect(data.manualRecords[0].amount).toBeNull();
  expect(data.manualRecords[0].currency).toBeNull();
});

it("revalidates permissions after a denied preview and never resolves a simulated success", async () => {
  previewResolution.mockRejectedValueOnce(
    new AdvertisingApiError("No tienes permiso para continuar.", 403),
  );
  const changed = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <AdvertisingLiveManualReview
      wire={wire()}
      companyId="company-id"
      token="test-token"
      storeIds={[]}
      canReconcile
      onChanged={changed}
    />,
  );
  await configureRepresented(user);
  await user.click(screen.getByRole("button", { name: "Ver antes y después" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso");
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(resolveRecord).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Guardar revisión" })).not.toBeInTheDocument();
});

it("keeps history readable when reconcile is denied, even when manage is allowed", async () => {
  const data = wire();
  data.capabilities = { canManage: true, canReconcile: false };
  audit.mockResolvedValueOnce({
    entries: [
      {
        id: "audit-id",
        manualRecordId: "record-id",
        actorId: "reviewer-id",
        action: "reopened",
        reason: "Importe necesita revisión",
        resolutionVersion: 2,
        accountId: null,
        classificationCurrency: null,
        exclusionKind: null,
        amount: "100.50",
        importedAmount: null,
        createdAt: "2026-10-09T12:00:00Z",
      },
    ],
  });
  const user = userEvent.setup();
  render(
    <AdvertisingLiveManualReview
      wire={data}
      companyId="company-id"
      token="test-token"
      storeIds={[]}
      canReconcile={false}
      onChanged={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Revisar este navegador" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ver registro" }));
  await user.click(screen.getByRole("button", { name: "Ver historial" }));
  expect(await screen.findByText("Importe necesita revisión")).toBeVisible();
  expect(audit).toHaveBeenCalledWith(
    "test-token",
    "company-id",
    "record-id",
    expect.any(AbortSignal),
  );
  expect(screen.queryByRole("button", { name: "Guardar revisión" })).not.toBeInTheDocument();
});

it("imports only explicit new selections, preserves unknown currency and distinguishes original sources", async () => {
  const records = [localRecord("original-id"), localRecord("store-1:2026-10-09:meta", "cierre")];
  readLocal.mockReturnValue({ records, warnings: [], nextOffset: null });
  previewImport.mockResolvedValueOnce(importResult(records, records[1].sourceId));
  const imported = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <AdvertisingManualImportDialog
      open
      companyId="company-id"
      token="test-token"
      storeIds={["store-1"]}
      canReconcile
      onClose={jest.fn()}
      onImported={imported}
      onAccessDenied={jest.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Ver vista previa" }));
  expect(await screen.findByText("Canal registrado: WhatsApp")).toBeVisible();
  expect(screen.getByText(/Tienda: store-1/)).toHaveTextContent("Meta Ads");
  expect(screen.getByRole("checkbox", { name: "Seleccionar nuevos" })).not.toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Seleccionar nuevos" }));
  await user.click(
    screen.getByRole("checkbox", {
      name: "Se guardarán por revisar. Todavía no se suman al gasto.",
    }),
  );
  await user.click(screen.getByRole("button", { name: /Guardar 1 registro/ }));
  await waitFor(() =>
    expect(importRecords).toHaveBeenCalledWith("test-token", "company-id", [records[0]]),
  );
  expect(records[0].currency).toBeNull();
  expect(records[0].amount).toBe("100.50");
});

it("continues beyond an empty reader window and refreshes capabilities after import preview is denied", async () => {
  readLocal
    .mockReturnValueOnce({ records: [], warnings: ["Hay más registros."], nextOffset: 1000 })
    .mockReturnValueOnce({ records: [localRecord("later-id")], warnings: [], nextOffset: null });
  previewImport.mockRejectedValueOnce(
    new AdvertisingApiError("No tienes permiso para continuar.", 403),
  );
  const denied = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <AdvertisingManualImportDialog
      open
      companyId="company-id"
      token="test-token"
      storeIds={["store-1"]}
      canReconcile
      onClose={jest.fn()}
      onImported={jest.fn()}
      onAccessDenied={denied}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Leer siguientes registros del navegador" }));
  expect(readLocal).toHaveBeenLastCalledWith({
    companyId: "company-id",
    storeIds: ["store-1"],
    offset: 1000,
  });
  await user.click(screen.getByRole("button", { name: "Ver vista previa" }));
  await waitFor(() => expect(denied).toHaveBeenCalledTimes(1));
  expect(importRecords).not.toHaveBeenCalled();
});
