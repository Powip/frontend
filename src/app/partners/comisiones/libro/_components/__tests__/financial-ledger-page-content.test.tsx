import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  requestOwnFinancialBalance,
  requestOwnFinancialLedger,
} from "@/features/partners/api/financial-ledger.api";
import type {
  FinancialLedgerBalance,
  FinancialLedgerEntry,
  FinancialLedgerPage,
} from "@/features/partners/models/financial-ledger";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "@/features/partners/test-utils/financial-ledger.fixture";
import {
  clearAdminReadDenial,
  denyAdminReadSession,
} from "@/features/partners/utils/admin-read-session-state";
import { clearCommissionReadDenial } from "@/features/partners/utils/commission-read-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { FinancialLedgerPageContent } from "../financial-ledger-page-content";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/api/financial-ledger.api", () => ({
  requestOwnFinancialLedger: jest.fn(),
  requestOwnFinancialBalance: jest.fn(),
}));
const USER = "11111111-1111-4111-8111-111111111111";
let client: QueryClient;
function page() {
  return (
    <QueryClientProvider client={client}>
      <FinancialLedgerPageContent />
    </QueryClientProvider>
  );
}
function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(page());
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
  clearCommissionReadDenial();
  mockAuth = { user: { id: USER }, accessToken: "private-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestOwnFinancialLedger).mockReset().mockResolvedValue(ledgerPageFixture());
  jest.mocked(requestOwnFinancialBalance).mockReset().mockResolvedValue(ledgerBalanceFixture);
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearCommissionReadDenial();
  clearAdminReadDenial();
});

it("renders exact negative and huge PEN strings with recorded audit IDs, never inferred payout eligibility", async () => {
  const gross = { ...ledgerEntryFixture, signedAmount: "99999999999999999999.12345678" };
  const discount: FinancialLedgerEntry = {
    ...ledgerEntryFixture,
    id: "99999999-9999-4999-8999-999999999999",
    kind: "PARTNER_FUNDED_DISCOUNT",
    signedAmount: "-99999999999999999999.00000001",
  };
  const aggregate = "-9999999999999999999999999999999999999999.12345678";
  jest.mocked(requestOwnFinancialLedger).mockResolvedValue(ledgerPageFixture([gross, discount]));
  jest.mocked(requestOwnFinancialBalance).mockResolvedValue({
    ...ledgerBalanceFixture,
    postedLedgerBalance: aggregate,
    postedEntryCount: 73,
  });
  renderPage();
  const table = await screen.findByRole("table", { name: "Libro financiero registrado" });
  expect(within(table).getByText(gross.signedAmount)).toBeInTheDocument();
  expect(within(table).getByText(discount.signedAmount)).toBeInTheDocument();
  expect(within(table).getByText("Comisión bruta")).toBeInTheDocument();
  expect(within(table).getByText("Descuento financiado")).toBeInTheDocument();
  expect(within(table).getByText(gross.id)).toBeInTheDocument();
  expect(within(table).getAllByText(gross.calculationItemId)).toHaveLength(2);
  expect(within(table).getAllByText(gross.paymentId)).toHaveLength(2);
  expect(within(table).getAllByText(gross.companyId)).toHaveLength(2);
  const balance = screen.getByRole("region", { name: "Saldo contable" });
  await waitFor(() => expect(within(balance).getByText(`PEN ${aggregate}`)).toBeInTheDocument());
  expect(within(balance).getByText("Movimientos contabilizados: 73")).toBeInTheDocument();
  expect(within(balance).getByText("Liquidación: pendiente de evaluación.")).toBeInTheDocument();
  expect(within(balance).getByText(`Corte UTC: ${ledgerBalanceFixture.asOf}`)).toHaveAttribute(
    "datetime",
    ledgerBalanceFixture.asOf,
  );
  expect(screen.getByText(/no dinero disponible para retirar/)).toBeInTheDocument();
  expect(
    screen.getByText(/retenciones, transferencias y pagos no se ha evaluado/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Saldo disponible|Listo para cobrar|Liquidado|Total ganado/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Pagar|Transferir|Retirar|Aprobar/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver a los cálculos registrados" })).toHaveAttribute(
    "href",
    "/partners/comisiones",
  );
});

it("renders the server's aggregate independently of partial pages and requests only the recorded cursor", async () => {
  const first: FinancialLedgerEntry[] = Array.from({ length: 20 }, (_, index) => ({
    ...ledgerEntryFixture,
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
  }));
  const second: FinancialLedgerEntry = {
    ...ledgerEntryFixture,
    id: "99999999-9999-4999-8999-999999999999",
    kind: "PARTNER_FUNDED_DISCOUNT",
    signedAmount: "-7.12500000",
  };
  const aggregate = "123456789012345678901234567890.87654321";
  jest.mocked(requestOwnFinancialBalance).mockResolvedValue({
    ...ledgerBalanceFixture,
    postedLedgerBalance: aggregate,
    postedEntryCount: 222,
  });
  jest
    .mocked(requestOwnFinancialLedger)
    .mockResolvedValueOnce(
      ledgerPageFixture(first, { hasMore: true, nextCursor: "server_next_cursor" }),
    )
    .mockResolvedValueOnce(ledgerPageFixture([second]));
  renderPage();
  const table = await screen.findByRole("table", { name: "Libro financiero registrado" });
  await screen.findByText(`PEN ${aggregate}`);
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  await userEvent.click(screen.getByRole("button", { name: "Ver más movimientos" }));
  await screen.findByText(second.signedAmount);
  expect(within(table).getAllByRole("row")).toHaveLength(22);
  expect(screen.getByText(`PEN ${aggregate}`)).toBeInTheDocument();
  expect(screen.getByText("Movimientos contabilizados: 222")).toBeInTheDocument();
  expect(requestOwnFinancialLedger).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: "server_next_cursor",
    limit: 20,
  });
  expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Ver más movimientos" })).not.toBeInTheDocument();
  expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
});

it("distinguishes real empty recorded entries and zero server balance from eligibility to collect", async () => {
  jest.mocked(requestOwnFinancialLedger).mockResolvedValue(ledgerPageFixture([]));
  jest.mocked(requestOwnFinancialBalance).mockResolvedValue({
    ...ledgerBalanceFixture,
    postedLedgerBalance: "0.00000000",
    postedEntryCount: 0,
    availability: "NO_POSTED_ENTRIES",
  });
  renderPage();
  await screen.findByText("No hay asientos registrados para tu cuenta.");
  await screen.findByText("PEN 0.00000000");
  expect(
    screen.getByText("No hay movimientos contabilizados. Esto no confirma elegibilidad de cobro."),
  ).toBeInTheDocument();
  expect(screen.getByText("Liquidación: pendiente de evaluación.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText(/Listo para cobrar|Disponible para retirar/)).not.toBeInTheDocument();
});

it("pending reads show loading without fabricated entries or zero balance", async () => {
  const ledgerPending = deferred<FinancialLedgerPage>();
  const balancePending = deferred<FinancialLedgerBalance>();
  jest.mocked(requestOwnFinancialLedger).mockReturnValueOnce(ledgerPending.promise);
  jest.mocked(requestOwnFinancialBalance).mockReturnValueOnce(balancePending.promise);
  renderPage();
  expect(screen.getByText("Consultando saldo contable…")).toBeInTheDocument();
  expect(screen.getByText("Consultando movimientos…")).toBeInTheDocument();
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByText("No hay asientos registrados para tu cuenta.")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await act(async () => {
    ledgerPending.resolve(ledgerPageFixture());
    balancePending.resolve(ledgerBalanceFixture);
  });
  await screen.findByRole("table", { name: "Libro financiero registrado" });
});

it.each([404, 503])(
  "a real HTTP %s does not become demo money or a fabricated successful empty result",
  async (status) => {
    jest.mocked(requestOwnFinancialLedger).mockRejectedValueOnce(buildAxiosError(status));
    jest.mocked(requestOwnFinancialBalance).mockRejectedValueOnce(buildAxiosError(status));
    renderPage();
    await screen.findByText("No pudimos consultar los movimientos contabilizados.");
    await screen.findByText("No pudimos consultar el saldo contabilizado.");
    expect(screen.getAllByRole("button", { name: "Reintentar" })).toHaveLength(2);
    expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No hay asientos|No hay movimientos contabilizados/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  },
);

it("an explicit transient-error retry renders only actual returned entries", async () => {
  jest.mocked(requestOwnFinancialLedger).mockRejectedValueOnce(buildAxiosError(503));
  renderPage();
  await screen.findByText("No pudimos consultar los movimientos contabilizados.");
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("table", { name: "Libro financiero registrado" });
  expect(screen.getByText(ledgerEntryFixture.signedAmount)).toBeInTheDocument();
  expect(requestOwnFinancialLedger).toHaveBeenCalledTimes(2);
  expect(requestOwnFinancialBalance).toHaveBeenCalledTimes(1);
});

it("a current ledger grant denial hides cached amounts and removes every retry control", async () => {
  renderPage();
  await screen.findByText(`PEN ${ledgerBalanceFixture.postedLedgerBalance}`);
  await screen.findByRole("table", { name: "Libro financiero registrado" });
  jest.mocked(requestOwnFinancialBalance).mockRejectedValueOnce(buildAxiosError(403));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["partners", "own-commission-evidence"] });
  });
  await screen.findByText("No tenés permiso vigente para consultar el libro financiero.");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.queryByText(`PEN ${ledgerBalanceFixture.postedLedgerBalance}`),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Saldo contable" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reintentar|Ver más/ })).not.toBeInTheDocument();
});

it("a shared current 401 takes priority over cached amounts and displays the expired-session message", async () => {
  renderPage();
  await screen.findByText(`PEN ${ledgerBalanceFixture.postedLedgerBalance}`);
  act(() => denyAdminReadSession(USER, "private-A", buildAxiosError(401)));
  await screen.findByText("Tu sesión ya no está vigente. Iniciá sesión para consultar el libro.");
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reintentar|Ver más/ })).not.toBeInTheDocument();
});

it("an account switch immediately hides old money until the new account's independent reads settle", async () => {
  const rendered = renderPage();
  await screen.findByText(`PEN ${ledgerBalanceFixture.postedLedgerBalance}`);
  await screen.findByRole("table", { name: "Libro financiero registrado" });
  const ledgerPending = deferred<FinancialLedgerPage>();
  const balancePending = deferred<FinancialLedgerBalance>();
  jest.mocked(requestOwnFinancialLedger).mockReturnValueOnce(ledgerPending.promise);
  jest.mocked(requestOwnFinancialBalance).mockReturnValueOnce(balancePending.promise);
  mockAuth = { user: { id: "99999999-9999-4999-8999-999999999999" }, accessToken: "private-B" };
  tokenStore.set(mockAuth.accessToken);
  rendered.rerender(page());
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Consultando saldo contable…")).toBeInTheDocument();
  await act(async () => {
    ledgerPending.resolve(ledgerPageFixture([]));
    balancePending.resolve({ ...ledgerBalanceFixture, postedLedgerBalance: "-2.50000000" });
  });
  await screen.findByText("PEN -2.50000000");
  expect(
    screen.queryByText(`PEN ${ledgerBalanceFixture.postedLedgerBalance}`),
  ).not.toBeInTheDocument();
});

it("anonymous access has no ledger transport, fabricated data or retry action", () => {
  mockAuth = null;
  tokenStore.set(null);
  renderPage();
  expect(
    screen.getByText("No tenés permiso vigente para consultar el libro financiero."),
  ).toBeInTheDocument();
  expect(requestOwnFinancialLedger).not.toHaveBeenCalled();
  expect(requestOwnFinancialBalance).not.toHaveBeenCalled();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText(/^PEN /)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reintentar|Ver más/ })).not.toBeInTheDocument();
});
