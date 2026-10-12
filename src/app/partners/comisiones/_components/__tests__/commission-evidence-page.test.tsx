import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "@/features/partners/api/commission-read.api";
import type {
  CommissionCalculationItem,
  CommissionEvaluationsPage,
  CommissionItemsPage,
} from "@/features/partners/models/commission-read";
import { getPartnerSummary } from "@/features/partners/services/get-partner-summary";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import {
  commissionEvaluationFixture,
  commissionItemFixture,
  commissionReadPageFixture,
} from "@/features/partners/test-utils/commission-read.fixture";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { clearCommissionReadDenial } from "@/features/partners/utils/commission-read-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { ComisionesPageContent } from "../comisiones-page-content";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/api/commission-read.api", () => ({
  requestOwnCommissionItems: jest.fn(),
  requestOwnCommissionEvaluations: jest.fn(),
}));
jest.mock("@/features/partners/services/get-partner-summary", () => ({
  getPartnerSummary: jest.fn(),
}));
const USER = "11111111-1111-4111-8111-111111111111";
let client: QueryClient;
function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <ComisionesPageContent />
    </QueryClientProvider>,
  );
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
  jest
    .mocked(requestOwnCommissionItems)
    .mockReset()
    .mockResolvedValue(commissionReadPageFixture([commissionItemFixture]));
  jest
    .mocked(requestOwnCommissionEvaluations)
    .mockReset()
    .mockResolvedValue(commissionReadPageFixture([commissionEvaluationFixture]));
  jest.mocked(getPartnerSummary).mockReset();
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearCommissionReadDenial();
  clearAdminReadDenial();
});

it("renders exact recorded amounts/rate fractions, absent names/bases and approval evidence without a summary call", async () => {
  renderPage();
  await screen.findByRole("table", { name: "Cálculos de comisión registrados" });
  expect(screen.getByText(commissionItemFixture.grossAmount)).toBeInTheDocument();
  expect(screen.getByText(commissionItemFixture.netAmount)).toBeInTheDocument();
  expect(screen.getByText("Inicial: 0.4000000000")).toBeInTheDocument();
  expect(screen.getByText("Recurrente: No registrada")).toBeInTheDocument();
  expect(screen.getByText("Nombre de empresa no disponible")).toBeInTheDocument();
  expect(screen.getByText("Plan: No disponible")).toBeInTheDocument();
  expect(screen.getByText(commissionItemFixture.approvalId)).toBeInTheDocument();
  expect(screen.getByText(/Resumen financiero no disponible/)).toBeInTheDocument();
  expect(screen.getByText(/No se suman ni se estiman totales/)).toBeInTheDocument();
  expect(
    screen.queryByText(/Standard|Bronce|Total ganado|Saldo disponible/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Pagar|Transferir|Retirar/ }),
  ).not.toBeInTheDocument();
  expect(getPartnerSummary).not.toHaveBeenCalled();
});
it("distinguishes no registered calculations from financial readiness or a zero balance", async () => {
  jest.mocked(requestOwnCommissionItems).mockResolvedValue(commissionReadPageFixture());
  jest.mocked(requestOwnCommissionEvaluations).mockResolvedValue(commissionReadPageFixture());
  renderPage();
  await screen.findByText(/Sin cálculos registrados/);
  expect(
    screen.getByText(/no confirma elegibilidad financiera ni un saldo de cero/),
  ).toBeInTheDocument();
  expect(screen.getByText(/No hay evaluaciones registradas/)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it("shows approved-context gaps explicitly and never prints unknown raw reason codes", async () => {
  jest.mocked(requestOwnCommissionEvaluations).mockResolvedValue(
    commissionReadPageFixture([
      {
        ...commissionEvaluationFixture,
        companyId: null,
        attributionId: null,
        reasons: [
          "APPROVED_FINANCIAL_CONTEXT_MISSING",
          "FUTURE_PRIVATE_PROVIDER_REASON",
          "INITIAL_ALLOCATION_EVIDENCE_MISSING",
        ],
      },
    ]),
  );
  renderPage();
  await screen.findByRole("table", { name: "Evaluaciones de comisión" });
  expect(screen.getByText("Falta contexto financiero aprobado.")).toBeInTheDocument();
  expect(
    screen.getByText("Falta evidencia de la asignación inicial aprobada."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Motivo de evaluación no disponible/)).toBeInTheDocument();
  expect(screen.queryByText("FUTURE_PRIVATE_PROVIDER_REASON")).not.toBeInTheDocument();
});
it("GENERATED means a recorded calculation, never a liquidation/payment confirmation", async () => {
  jest.mocked(requestOwnCommissionEvaluations).mockResolvedValue(
    commissionReadPageFixture([
      {
        ...commissionEvaluationFixture,
        state: "GENERATED",
        reasons: [],
        itemId: commissionItemFixture.id,
      },
    ]),
  );
  renderPage();
  await screen.findByText("Cálculo registrado");
  expect(
    screen.getByText("Sin motivos de bloqueo registrados; no confirma liquidación ni pago."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Listo para cobrar|Pagado|Liquidado/)).not.toBeInTheDocument();
});
it("loads the server's next cursor without aggregating the partial page", async () => {
  const first = Array.from(
    { length: 20 },
    (_, index): CommissionCalculationItem => ({
      ...commissionItemFixture,
      id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      observationId: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
      businessName: `Empresa registrada ${index + 1}`,
    }),
  );
  jest
    .mocked(requestOwnCommissionItems)
    .mockResolvedValueOnce(
      commissionReadPageFixture(first, { hasMore: true, nextCursor: "opaque_next" }),
    )
    .mockResolvedValueOnce(
      commissionReadPageFixture([
        {
          ...commissionItemFixture,
          id: "99999999-9999-4999-8999-999999999999",
          businessName: "Empresa siguiente",
        },
      ]),
    );
  renderPage();
  await screen.findByText("Empresa registrada 1");
  await userEvent.click(screen.getByRole("button", { name: "Ver más cálculos" }));
  await screen.findByText("Empresa siguiente");
  expect(screen.getByText("Empresa registrada 1")).toBeInTheDocument();
  expect(requestOwnCommissionItems).toHaveBeenLastCalledWith({
    accessToken: "private-A",
    signal: expect.any(AbortSignal),
    cursor: "opaque_next",
    limit: 20,
  });
  expect(screen.queryByRole("button", { name: "Ver más cálculos" })).not.toBeInTheDocument();
  expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
});
it("a current 403 hides earlier exact money/evaluation data and has no retry", async () => {
  renderPage();
  await screen.findByText(commissionItemFixture.netAmount);
  jest.mocked(requestOwnCommissionEvaluations).mockRejectedValueOnce(buildAxiosError(403));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["partners", "own-commission-evidence"] });
  });
  await screen.findByText("No tenés permiso vigente para leer comisiones.");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText(commissionItemFixture.netAmount)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();
});
it("an account switch immediately hides prior financial evidence", async () => {
  const rendered = renderPage();
  await screen.findByText(commissionItemFixture.netAmount);
  const itemsPending = deferred<CommissionItemsPage>();
  const evaluationsPending = deferred<CommissionEvaluationsPage>();
  jest.mocked(requestOwnCommissionItems).mockReturnValueOnce(itemsPending.promise);
  jest.mocked(requestOwnCommissionEvaluations).mockReturnValueOnce(evaluationsPending.promise);
  mockAuth = { user: { id: "99999999-9999-4999-8999-999999999999" }, accessToken: "private-B" };
  tokenStore.set(mockAuth.accessToken);
  rendered.rerender(
    <QueryClientProvider client={client}>
      <ComisionesPageContent />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText(commissionItemFixture.netAmount)).not.toBeInTheDocument();
  await act(async () => {
    itemsPending.resolve(commissionReadPageFixture());
    evaluationsPending.resolve(commissionReadPageFixture());
  });
});
it("an ordinary read error can retry but never displays fabricated empty/success results", async () => {
  jest.mocked(requestOwnCommissionItems).mockRejectedValueOnce(buildAxiosError(503));
  renderPage();
  await screen.findByText("No pudimos leer los cálculos registrados.");
  expect(screen.queryByText(/Sin cálculos registrados/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText(commissionItemFixture.netAmount);
  await waitFor(() => expect(requestOwnCommissionItems).toHaveBeenCalledTimes(2));
});
