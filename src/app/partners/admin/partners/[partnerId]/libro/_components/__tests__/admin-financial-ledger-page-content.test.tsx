import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  requestAdminFinancialBalance,
  requestAdminFinancialLedger,
} from "@/features/partners/api/financial-ledger.api";
import type {
  FinancialLedgerBalance,
  FinancialLedgerPage,
} from "@/features/partners/models/financial-ledger";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "@/features/partners/test-utils/financial-ledger.fixture";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { AdminFinancialLedgerPageContent } from "../admin-financial-ledger-page-content";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/api/financial-ledger.api", () => ({
  requestAdminFinancialLedger: jest.fn(),
  requestAdminFinancialBalance: jest.fn(),
}));
const PARTNER = ledgerEntryFixture.partnerId;
const OTHER = "99999999-9999-4999-8999-999999999999";
let client: QueryClient;
function page(partnerId = PARTNER) {
  return (
    <QueryClientProvider client={client}>
      <AdminFinancialLedgerPageContent partnerId={partnerId} />
    </QueryClientProvider>
  );
}
function renderPage(partnerId = PARTNER) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(page(partnerId));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
beforeEach(() => {
  clearAdminReadDenial();
  mockAuth = {
    user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: ["PARTNERS_VIEW"] },
    accessToken: "private-A",
  };
  tokenStore.set("private-A");
  jest.mocked(requestAdminFinancialLedger).mockReset().mockResolvedValue(ledgerPageFixture());
  jest
    .mocked(requestAdminFinancialBalance)
    .mockReset()
    .mockResolvedValue({
      ...ledgerBalanceFixture,
      postedLedgerBalance: "95.22",
      postedEntryCount: 88,
    });
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminReadDenial();
});

it("shows exact signed entries and the separate real 95.22 aggregate, never payable money or tax actions", async () => {
  const discount = {
    ...ledgerEntryFixture,
    id: OTHER,
    kind: "PARTNER_FUNDED_DISCOUNT" as const,
    signedAmount: "-99999999999999999999.12345678",
  };
  jest
    .mocked(requestAdminFinancialLedger)
    .mockResolvedValue(ledgerPageFixture([ledgerEntryFixture, discount]));
  renderPage();
  expect(
    screen.getByRole("heading", { name: "Libro financiero del partner" }),
  ).toBeInTheDocument();
  const table = await screen.findByRole("table", {
    name: "Libro financiero del partner registrado",
  });
  expect(within(table).getByText(discount.signedAmount)).toBeInTheDocument();
  expect(within(table).getByText("Descuento financiado")).toBeInTheDocument();
  expect(within(table).getAllByText(ledgerEntryFixture.calculationItemId)).toHaveLength(2);
  const balance = screen.getByRole("region", { name: "Saldo contable del partner" });
  await waitFor(() => expect(within(balance).getByText("PEN 95.22")).toBeInTheDocument());
  expect(within(balance).getByText("Movimientos contabilizados: 88")).toBeInTheDocument();
  expect(within(balance).getByText("Liquidación: pendiente de evaluación.")).toBeInTheDocument();
  expect(screen.getByText(/no de la suma de estas páginas/)).toBeInTheDocument();
  expect(screen.getByText(/no dinero disponible para retirar/)).toBeInTheDocument();
  expect(
    screen.queryByText(/Saldo disponible|Listo para cobrar|Total ganado|Retención:|Impuesto:/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Retirar|Transferir|Pagar|Aprobar/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver a la ficha del partner" })).toHaveAttribute(
    "href",
    `/partners/admin/partners/${PARTNER}`,
  );
});

it("preserves a huge negative aggregate as an exact string without number conversion", async () => {
  const aggregate = "-9999999999999999999999999999999999999999.12345678";
  jest
    .mocked(requestAdminFinancialBalance)
    .mockResolvedValue({ ...ledgerBalanceFixture, postedLedgerBalance: aggregate });
  renderPage();
  await screen.findByText(`PEN ${aggregate}`);
  expect(screen.queryByText(/e\+\d/)).not.toBeInTheDocument();
});

it("paginates only the selected partner's cursor without replacing or summing the server aggregate", async () => {
  const first = Array.from({ length: 20 }, (_, index) => ({
    ...ledgerEntryFixture,
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
  }));
  jest
    .mocked(requestAdminFinancialLedger)
    .mockResolvedValueOnce(ledgerPageFixture(first, { hasMore: true, nextCursor: "partner_next" }))
    .mockResolvedValueOnce(
      ledgerPageFixture([{ ...ledgerEntryFixture, id: OTHER, signedAmount: "77.12345678" }]),
    );
  renderPage();
  const table = await screen.findByRole("table", {
    name: "Libro financiero del partner registrado",
  });
  await screen.findByText("PEN 95.22");
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  await userEvent.click(screen.getByRole("button", { name: "Ver más movimientos" }));
  await screen.findByText("77.12345678");
  expect(within(table).getAllByRole("row")).toHaveLength(22);
  expect(screen.getByText("PEN 95.22")).toBeInTheDocument();
  expect(requestAdminFinancialBalance).toHaveBeenCalledTimes(1);
  expect(requestAdminFinancialLedger).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    partnerId: PARTNER,
    cursor: "partner_next",
    limit: 20,
  });
  expect(screen.queryByRole("button", { name: "Ver más movimientos" })).not.toBeInTheDocument();
});

it("an explicitly empty server ledger is distinct from eligibility and not a fabricated default", async () => {
  jest.mocked(requestAdminFinancialLedger).mockResolvedValue(ledgerPageFixture([]));
  jest
    .mocked(requestAdminFinancialBalance)
    .mockResolvedValue({
      ...ledgerBalanceFixture,
      postedLedgerBalance: "0.00000000",
      postedEntryCount: 0,
      availability: "NO_POSTED_ENTRIES",
    });
  renderPage();
  await screen.findByText("No hay asientos registrados para este partner.");
  await screen.findByText("PEN 0.00000000");
  expect(
    screen.getByText("No hay movimientos contabilizados. Esto no confirma elegibilidad de cobro."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("a real read failure cannot fabricate a zero balance or empty success and can retry actual data", async () => {
  jest.mocked(requestAdminFinancialLedger).mockRejectedValueOnce(buildAxiosError(503));
  jest.mocked(requestAdminFinancialBalance).mockRejectedValueOnce(buildAxiosError(503));
  renderPage();
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Reintentar" })).toHaveLength(2),
  );
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/No hay asientos|No hay movimientos contabilizados/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(
    within(screen.getByRole("region", { name: "Saldo contable del partner" })).getByRole("button", {
      name: "Reintentar",
    }),
  );
  await screen.findByText("PEN 95.22");
});

it.each([401, 403])(
  "a current HTTP%s masks cached amounts, table and retry controls",
  async (status) => {
    renderPage();
    await screen.findByText("PEN 95.22");
    await screen.findByRole("table", { name: "Libro financiero del partner registrado" });
    jest.mocked(requestAdminFinancialBalance).mockRejectedValueOnce(buildAxiosError(status));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["partners", "user"] });
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        status === 401 ? /sesión expiró/ : /No tenés permiso/,
      ),
    );
    expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reintentar|Ver más/ })).not.toBeInTheDocument();
  },
);

it("a real unknown partner is 404, never displayed as zero or mixed with retained balance", async () => {
  jest.mocked(requestAdminFinancialLedger).mockRejectedValueOnce(buildAxiosError(404));
  renderPage();
  await screen.findByText("No encontramos este partner.");
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("changing partner scope hides prior data until the selected partner's own responses settle", async () => {
  const rendered = renderPage();
  await screen.findByText("PEN 95.22");
  const pendingLedger = deferred<FinancialLedgerPage>();
  const pendingBalance = deferred<FinancialLedgerBalance>();
  jest.mocked(requestAdminFinancialLedger).mockReturnValueOnce(pendingLedger.promise);
  jest.mocked(requestAdminFinancialBalance).mockReturnValueOnce(pendingBalance.promise);
  rendered.rerender(page(OTHER));
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Consultando saldo contable…")).toBeInTheDocument();
  await act(async () => {
    pendingLedger.resolve(ledgerPageFixture([]));
    pendingBalance.resolve({
      ...ledgerBalanceFixture,
      partnerId: OTHER,
      postedLedgerBalance: "-2.50000000",
    });
  });
  await screen.findByText("PEN -2.50000000");
  expect(screen.queryByText("PEN 95.22")).not.toBeInTheDocument();
});

it.each([
  null,
  {
    user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: [] },
    accessToken: "private-A",
  },
])("no VIEW reveals no data or transport: %#", (auth) => {
  mockAuth = auth;
  renderPage();
  expect(screen.getByRole("alert")).toHaveTextContent("PARTNERS_VIEW");
  expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
  expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
});

it("invalid route scope never reaches an administrative or global ledger", () => {
  renderPage("../me");
  expect(screen.getByRole("alert")).toHaveTextContent("El identificador del partner no es válido.");
  expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
  expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
});
