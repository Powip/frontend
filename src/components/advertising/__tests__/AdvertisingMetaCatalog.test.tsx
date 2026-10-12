import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAdvertisingMetaCatalog } from "@/hooks/useAdvertisingMeta";
import { type MetaCatalogResponse, syncMetaModule } from "@/services/advertisingMetaService";
import { AdvertisingMetaCatalogPanel } from "../AdvertisingMetaCatalogPanel";
import {
  formatMetaCostPerResult,
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
beforeAll(() => {
  // jsdom does not implement the browser pointer/scroll APIs used by the Powip Select.
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});
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

it("keeps unavailable results honest and secondary data out of the comparison without auto-sync", () => {
  mount();
  const table = screen.getByRole("table", { name: "Anuncios" });
  expect(within(table).getAllByText("No disponible")).toHaveLength(4);
  expect(
    screen.queryByRole("columnheader", { name: "Último estado registrado" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Impresiones" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Importar historial" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filtros" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("51 anuncios · Página 1")).toBeVisible();
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
  expect(screen.getAllByText(/Gasto por revisar/).length).toBeGreaterThan(0);
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
      sortBy: "results",
      resultType: "messages",
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

it("shows a failed durable history import while preserving existing results and allowing explicit retry", async () => {
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
  await userEvent.setup().click(screen.getByRole("button", { name: "Filtros" }));
  expect(screen.getByRole("button", { name: "Importar historial" })).toBeEnabled();
  expect(
    within(screen.getByRole("table", { name: "Anuncios" })).getByText("Anuncio real"),
  ).toBeVisible();
  expect(sync).not.toHaveBeenCalled();
});

it("keeps campaign drill-down tied to the same account and period", () => {
  const catalog = data();
  catalog.rows[0].level = "campaign";
  mockCatalog(catalog);
  mount("campaign");
  expect(
    within(screen.getByRole("table", { name: "Campañas" })).getByRole("link", {
      name: "Ver conjuntos",
    }),
  ).toHaveAttribute(
    "href",
    "/publicidad/campanas?from=2026-10-01&to=2026-10-02&accountId=account&campaignId=456&resultType=messages",
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
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filtros" }));
  await user.click(screen.getByRole("button", { name: "Importar historial" }));
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
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filtros" }));
  await user.click(screen.getByRole("button", { name: "Importar historial" }));
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

it("prioritizes server costs and switches conversion without mixing message and purchase aliases", async () => {
  const catalog = data();
  catalog.rows[0].insights.actions = [
    { actionType: "purchase", value: "99" },
    { actionType: "omni_purchase", value: "99" },
  ];
  catalog.rows[0].insights.resultMetrics = {
    messages: { count: "20", costPerResult: "3.25", status: "complete" },
    webPurchases: { count: "2", costPerResult: "32.50", status: "complete" },
  };
  mockCatalog(catalog);
  mount();
  const table = screen.getByRole("table", { name: "Anuncios" });
  expect(
    within(table)
      .getAllByRole("columnheader")
      .slice(1, 4)
      .map((cell) => cell.textContent),
  ).toEqual(["Costo por conversación", "Conversaciones", "Gasto"]);
  expect(within(table).getByText(/3\.25/)).toBeVisible();
  expect(within(table).getByText("20")).toBeVisible();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  await user.click(screen.getByRole("button", { name: "Compras por web" }));
  expect(within(table).getByRole("columnheader", { name: "Costo por compra" })).toBeVisible();
  expect(within(table).getByText(/32\.50/)).toBeVisible();
  expect(within(table).getByText("2")).toBeVisible();
  expect(within(table).queryByText("99")).not.toBeInTheDocument();
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({ resultType: "webPurchases", sortBy: "results", page: 1 }),
  );
  expect(sync).not.toHaveBeenCalled();
});

it("requests lower costs first for one explicit currency and resets paging when the scope changes", async () => {
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  if (!screen.queryByRole("combobox", { name: "Ordenar por" }))
    await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  await user.click(screen.getByRole("combobox", { name: "Ordenar por" }));
  await user.click(screen.getByRole("option", { name: "Menor costo por resultado" }));
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({
      resultType: "messages",
      sortBy: "costPerResult",
      sortOrder: "asc",
      currency: "PEN",
      page: 1,
    }),
  );
  await user.click(screen.getByRole("combobox", { name: "Moneda" }));
  await user.click(screen.getByRole("option", { name: "Todas las monedas" }));
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({ currency: undefined, sortBy: "results", sortOrder: "desc", page: 1 }),
  );
});

it("requires one currency before comparing costs and allows conversion counts across currencies", async () => {
  const catalog = data();
  catalog.accounts.push({ ...catalog.accounts[0], id: "usd", name: "Cuenta USD", currency: "USD" });
  mockCatalog(catalog);
  mount();
  expect(query).toHaveBeenCalledWith(
    expect.objectContaining({ sortBy: "results", currency: undefined }),
  );
  const user = userEvent.setup();
  if (!screen.queryByRole("combobox", { name: "Ordenar por" }))
    await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  await user.click(screen.getByRole("combobox", { name: "Ordenar por" }));
  expect(screen.getByRole("option", { name: "Menor costo por resultado" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("combobox", { name: "Moneda" }));
  await user.click(screen.getByRole("option", { name: "USD" }));
  const help = screen.getByText("Cómo leer estos datos").closest("details");
  if (!help) throw new Error("Missing data help");
  expect(within(help).getByText(/^Cuenta USD · Gasto:/)).toBeInTheDocument();
  expect(within(help).queryByText(/^Cuenta · Gasto:/)).not.toBeInTheDocument();
  if (!screen.queryByRole("combobox", { name: "Ordenar por" }))
    await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  await user.click(screen.getByRole("combobox", { name: "Ordenar por" }));
  await user.click(screen.getByRole("option", { name: "Menor costo por resultado" }));
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({ currency: "USD", sortBy: "costPerResult", sortOrder: "asc" }),
  );
});

it("never invents cost from raw actions, partial metrics or zero results", () => {
  expect(formatMetaCostPerResult(undefined, "PEN")).toBe("No disponible");
  expect(
    formatMetaCostPerResult({ count: "2", costPerResult: "3", status: "partial" }, "PEN"),
  ).toBe("No disponible");
  expect(
    formatMetaCostPerResult({ count: null, costPerResult: "3", status: "unknown" }, "PEN"),
  ).toBe("No disponible");
  expect(
    formatMetaCostPerResult({ count: "0.00", costPerResult: null, status: "complete" }, "PEN"),
  ).toBe("—");
  expect(
    formatMetaCostPerResult(
      { count: "2", costPerResult: "1000000000000000000.01", status: "complete" },
      "PEN",
    ),
  ).toContain("1,000,000,000,000,000,000.01");
});

it("uses conversion availability even when all spending is reconciled, and keeps mobile cost and quantity together", async () => {
  const catalog = data();
  catalog.rows[0].insights.coverage = {
    ...coverage,
    status: "complete",
    coveredDays: 2,
    reconciliation: {
      status: "matched",
      comparedDays: 2,
      mismatchedDays: 0,
      missingLedgerDays: 0,
      provisionalDays: 0,
      totalDays: 2,
    },
  };
  catalog.rows[0].insights.resultMetrics = {
    messages: { count: "15", costPerResult: null, status: "partial" },
    webPurchases: { count: null, costPerResult: null, status: "unknown" },
  };
  mockCatalog(catalog);
  mount();
  const table = screen.getByRole("table", { name: "Anuncios" });
  expect(within(table).getByText("Parcial")).toBeVisible();
  expect(within(table).queryByText("Completo")).not.toBeInTheDocument();
  const mobile = screen.getByRole("list", { name: "Anuncios en móvil" });
  expect(within(mobile).getByText("Costo por conversación")).toBeVisible();
  expect(within(mobile).getByText("Conversaciones")).toBeVisible();
  expect(within(mobile).getByText("15")).toBeVisible();
  await userEvent.setup().click(screen.getByRole("button", { name: "Compras por web" }));
  expect(within(table).getAllByText("No disponible")).toHaveLength(4);
  expect(within(table).queryByText("Completo")).not.toBeInTheDocument();
});

it("distinguishes explicit zero from unavailable results and preserves filters when collapsed", async () => {
  const catalog = data();
  catalog.rows[0].insights.resultMetrics = {
    messages: { count: "0", costPerResult: null, status: "complete" },
    webPurchases: { count: "1", costPerResult: "0", status: "complete" },
  };
  mockCatalog(catalog);
  mount();
  const table = screen.getByRole("table", { name: "Anuncios" });
  expect(within(table).getByText("—")).toBeVisible();
  expect(within(table).getByText("Sin resultados")).toBeVisible();
  expect(within(table).getByText("0")).toBeVisible();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  await user.click(screen.getByRole("combobox", { name: "Moneda" }));
  await user.click(screen.getByRole("option", { name: "PEN" }));
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  expect(screen.queryByRole("combobox", { name: "Moneda" })).not.toBeInTheDocument();
  expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ currency: "PEN" }));
  await user.click(screen.getByRole("button", { name: "Compras por web" }));
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({ currency: "PEN", resultType: "webPurchases", page: 1 }),
  );
  expect(within(table).getByText(/0\.00/)).toBeVisible();
});
