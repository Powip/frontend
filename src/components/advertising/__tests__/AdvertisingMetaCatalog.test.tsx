import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import { type MetaCatalogResponse, syncMetaModule } from "@/services/advertisingMetaService";
import { AdvertisingMetaCatalogPanel } from "../AdvertisingMetaCatalogPanel";
import {
  formatMetaNumber,
  formatMetaSpend,
  metaActionValue,
  validMetaPeriod,
} from "../advertising-meta-model";

jest.mock("@/hooks/useAdvertisingMeta", () => ({ useAdvertisingMetaCatalog: jest.fn() }));
jest.mock("@/services/advertisingMetaService", () => ({ syncMetaModule: jest.fn() }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default:
    () => (props: { selected: { id: string; accountId: string }; from: string; to: string }) => (
      <output aria-label="Detalle enlazado">
        {props.selected.id} · {props.selected.accountId} · {props.from} · {props.to}
      </output>
    ),
}));
const query = jest.mocked(useAdvertisingMetaCatalog);
const sync = jest.mocked(syncMetaModule);
const coverage = {
  status: "partial" as const,
  coveredDays: 1,
  totalDays: 2,
  provisionalDays: 0,
  lastSuccessfulAt: null,
  lastErrorCode: null,
};
function data(): MetaCatalogResponse {
  return {
    source: "meta",
    from: "2026-10-01",
    to: "2026-10-02",
    attribution: { windows: ["7d_click", "1d_view"], reportTime: "impression", source: "meta" },
    capabilities: {
      canRead: true,
      canSync: false,
      canManageAds: false,
      reason: "ADS_MANAGEMENT_NOT_GRANTED",
    },
    accounts: [
      {
        id: "account",
        externalId: "123",
        name: "Cuenta",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        catalogUpdatedAt: null,
        manageUrl: "",
        coverage,
        historyImport: null,
      },
    ],
    rows: [
      {
        id: "456",
        accountId: "account",
        campaignId: "789",
        adsetId: "888",
        level: "ad",
        name: "Anuncio real",
        status: null,
        effectiveStatus: null,
        objective: null,
        currency: "PEN",
        timeZone: "America/Lima",
        insights: {
          spend: null,
          impressions: "1000000000000000000",
          clicks: "0",
          actions: null,
          coverage,
        },
      },
    ],
    pagination: { page: 1, pageSize: 50, total: 51, hasMore: true },
  };
}
function mockCatalog(catalog = data()) {
  query.mockReturnValue({
    data: catalog,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useAdvertisingMetaCatalog>);
}
function mount(
  level: "ad" | "campaign" = "ad",
  from = "2026-10-01",
  focused?: { initialAccountId: string; initialAdId: string },
) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AdvertisingMetaCatalogPanel
        token="token"
        actorId="actor"
        companyId="company"
        from={from}
        to="2026-10-02"
        level={level}
        {...focused}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockCatalog();
});

it("preserves missing values, explicit zero, exact counts and platform coverage without auto-sync", () => {
  mount();
  expect(screen.getByText("No disponible")).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
  expect(screen.getByText("1,000,000,000,000,000,000")).toBeVisible();
  expect(screen.getByText("Estado no disponible")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Último estado registrado" })).toBeVisible();
  expect(screen.queryByRole("columnheader", { name: "Estado Meta" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Importar historial" })).toBeDisabled();
  expect(screen.getByText(/no equivalen a pedidos/)).toBeVisible();
  expect(sync).not.toHaveBeenCalled();
});

it("shows a Meta rate backoff as waiting without implying an active provider call", () => {
  const catalog = data();
  catalog.accounts[0].historyImport = {
    accountId: "account",
    status: "retrying",
    availableFrom: "2025-01-01",
    availableTo: "2026-10-11",
    nextTo: "2026-10-11",
    completedWindows: 0,
    totalWindows: 37,
    retryCount: 1,
    errorCode: "PROVIDER_RATE",
    updatedAt: "2026-10-11T00:00:00Z",
  };
  mockCatalog(catalog);
  mount();
  expect(screen.getByText(/Esperando a Meta\. Se reintentará automáticamente\./)).toBeVisible();
  expect(sync).not.toHaveBeenCalled();
});

it("shows a spend mismatch as review instead of complete data despite every day being imported", () => {
  const catalog = data();
  const mismatched = {
    ...coverage,
    status: "partial" as const,
    coveredDays: 2,
    reconciliation: {
      status: "mismatch" as const,
      comparedDays: 2,
      mismatchedDays: 1,
      missingLedgerDays: 0,
      provisionalDays: 0,
      totalDays: 2,
    },
  };
  catalog.accounts[0].coverage = mismatched;
  catalog.rows[0].insights.coverage = mismatched;
  mockCatalog(catalog);
  mount();
  expect(screen.getAllByText("Gasto por revisar").length).toBeGreaterThan(0);
  expect(screen.queryByText("Datos completos")).not.toBeInTheDocument();
  expect(sync).not.toHaveBeenCalled();
});

it("uses server paging and desc ordering within the current actor and company", async () => {
  mount();
  await userEvent.setup().click(screen.getByRole("button", { name: "Siguiente" }));
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({
      actorId: "actor",
      companyId: "company",
      page: 2,
      pageSize: 50,
      sortBy: "impressions",
      sortOrder: "desc",
    }),
  );
});

it("focuses the linked real ad and detail in the same account and period without writing on mount", () => {
  mount("ad", "2026-10-01", { initialAccountId: "account", initialAdId: "456" });
  expect(query).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "actor",
      companyId: "company",
      accountId: "account",
      adId: "456",
      from: "2026-10-01",
      to: "2026-10-02",
    }),
  );
  expect(screen.getByLabelText("Detalle enlazado")).toHaveTextContent(
    "456 · account · 2026-10-01 · 2026-10-02",
  );
  expect(sync).not.toHaveBeenCalled();
});

it("shows a failed durable history import while preserving existing results and allowing explicit retry", () => {
  const catalog = data();
  catalog.capabilities.canSync = true;
  catalog.accounts[0].historyImport = {
    accountId: "account",
    status: "failed",
    availableFrom: "2025-01-01",
    availableTo: "2026-10-11",
    nextTo: "2026-09-11",
    completedWindows: 1,
    totalWindows: 22,
    retryCount: 3,
    errorCode: "PROVIDER_FAILED",
    updatedAt: "2026-10-11T00:00:00Z",
  };
  mockCatalog(catalog);
  mount();
  expect(screen.getByText(/No se completó. Los datos guardados se conservan./)).toBeVisible();
  expect(screen.getByRole("button", { name: "Importar historial" })).toBeEnabled();
  expect(screen.getByText("Anuncio real")).toBeVisible();
  expect(sync).not.toHaveBeenCalled();
});

it("keeps campaign drill-down tied to the same account and period", () => {
  const catalog = data();
  catalog.rows[0].level = "campaign";
  mockCatalog(catalog);
  mount("campaign");
  expect(screen.getByRole("link", { name: "Ver conjuntos" })).toHaveAttribute(
    "href",
    "/publicidad/campanas?from=2026-10-01&to=2026-10-02&accountId=account&campaignId=456",
  );
});

it("updates only with server permission and reports a partial failure honestly", async () => {
  const catalog = data();
  catalog.capabilities.canSync = true;
  mockCatalog(catalog);
  sync.mockResolvedValue({
    jobs: [],
    runs: [{ accountId: "account", from: catalog.from, to: catalog.to, status: "failed" }],
  });
  mount();
  await userEvent.setup().click(screen.getByRole("button", { name: "Importar historial" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se completó"));
  expect(sync).toHaveBeenCalledWith("token", "company", {
    from: "2026-10-01",
    to: "2026-10-02",
    accountId: undefined,
  });
});

it("blocks overlong catalog queries without altering full account history", () => {
  mount("ad", "2024-01-01");
  expect(screen.getByRole("status")).toHaveTextContent("hasta 366 días");
  expect(query).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
});

it("shows durable import progress without presenting an enqueued job as imported results", async () => {
  const catalog = data();
  catalog.capabilities.canSync = true;
  const job = {
    accountId: "account",
    status: "running" as const,
    availableFrom: "2025-01-01",
    availableTo: "2026-10-11",
    nextTo: "2026-09-11",
    completedWindows: 1,
    totalWindows: 22,
    retryCount: 0,
    errorCode: null,
    updatedAt: "2026-10-11T00:00:00Z",
  };
  mockCatalog(catalog);
  sync.mockResolvedValue({ jobs: [job], runs: [] });
  mount();
  await userEvent.setup().click(screen.getByRole("button", { name: "Importar historial" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Importación del historial en curso"),
  );
  expect(screen.queryByText("Resultados de Meta actualizados.")).not.toBeInTheDocument();
});

it("does not merge different Meta action types or turn absent actions into zero", () => {
  expect(
    metaActionValue(
      [
        { actionType: "purchase", value: "2" },
        { actionType: "omni_purchase", value: "2" },
      ],
      "purchase",
    ),
  ).toBe("2");
  expect(metaActionValue(null, "purchase")).toBeNull();
  expect(formatMetaSpend("1000000000000000000.01", "PEN")).toContain(
    "1,000,000,000,000,000,000.01",
  );
  expect(formatMetaNumber(null)).toBe("No disponible");
  expect(validMetaPeriod("2026-02-30", "2026-03-01")).toBe(false);
});
