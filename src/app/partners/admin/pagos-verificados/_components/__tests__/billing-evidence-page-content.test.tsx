import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { adminBillingEvidenceClient } from "@/features/partners/api/admin-billing-evidence.api";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import {
  BILLING_USER_A,
  billingEvidence,
  billingPage,
} from "@/features/partners/test-utils/billing-evidence.fixture";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { BillingEvidencePageContent } from "../billing-evidence-page-content";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BillingEvidencePageContent />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mockAuth = {
    user: { id: BILLING_USER_A, permissions: ["PARTNERS_VIEW"] },
    accessToken: "private-UI-bearer",
  };
  tokenStore.set(mockAuth.accessToken);
  clearAdminReadDenial();
});
afterEach(() => {
  cleanup();
  client?.clear();
  jest.restoreAllMocks();
  tokenStore.set(null);
  clearAdminReadDenial();
});

it("shows exact real evidence and detail with no payment, commission or event replay action", async () => {
  const get = jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValueOnce({ data: billingPage() })
    .mockResolvedValueOnce({ data: billingEvidence() });
  const post = jest.spyOn(adminBillingEvidenceClient, "post");
  mount();
  await screen.findByText("Factura invoice-test-123");
  expect(screen.getByText("Importe real: 89.12345678 PEN")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/no aprueba un cobro/);
  await userEvent.click(screen.getByRole("button", { name: "Ver evidencia invoice-test-123" }));
  const detail = await screen.findByRole("region", { name: "Detalle de evidencia" });
  expect(within(detail).getByText("Importe real: 89.12345678")).toBeInTheDocument();
  expect(within(detail).getByText(/priceList, discount/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Aprobar|Pagar|Reprocesar|Confirmar pago|Liquidar/ }),
  ).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(2);
});

it("unknown amount/currency remain explicitly unproven, never S/0", async () => {
  const item = billingEvidence({
    eventType: "billing.invoice-paid-observed",
    factType: "INVOICE_PAID_OBSERVED",
    amount: null,
    currency: null,
    paidAt: null,
  });
  jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValueOnce({ data: billingPage([item]) })
    .mockResolvedValueOnce({ data: item });
  mount();
  await screen.findByText("Importe real: No demostrado");
  await userEvent.click(screen.getByRole("button", { name: /Ver evidencia invoice/ }));
  const detail = await screen.findByRole("region", { name: "Detalle de evidencia" });
  expect(within(detail).getByText("Moneda: No demostrada")).toBeInTheDocument();
  expect(within(detail).getByText("Fecha de pago: No demostrada")).toBeInTheDocument();
  expect(screen.queryByText(/S\/\s*0|0\.00/)).not.toBeInTheDocument();
});

it("filters and follows the actual cursor without inventing records", async () => {
  const get = jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValueOnce({
      data: billingPage([billingEvidence()], { hasMore: true, nextCursor: "server-cursor" }),
    })
    .mockResolvedValueOnce({ data: billingPage([]) })
    .mockResolvedValueOnce({ data: billingPage([]) });
  mount();
  await screen.findByText("Factura invoice-test-123");
  await userEvent.click(screen.getByRole("button", { name: "Cargar más eventos" }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { cursor: "server-cursor", limit: 20 } }),
    ),
  );
  await userEvent.selectOptions(screen.getByLabelText("Estado del evento"), "QUARANTINED");
  await screen.findByText("No hay eventos de Billing para este filtro.");
  expect(screen.queryByText("Factura invoice-test-123")).not.toBeInTheDocument();
  expect(get).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ params: { state: "QUARANTINED", limit: 20 } }),
  );
});

it.each([401, 403, 503])("HTTP%s hides evidence and reports the real failure", async (status) => {
  jest.spyOn(adminBillingEvidenceClient, "get").mockRejectedValue(buildAxiosError(status));
  mount();
  await screen.findByRole("alert");
  expect(screen.queryByText("Factura invoice-test-123")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Detalle de evidencia" })).not.toBeInTheDocument();
});

it("does not fetch without explicit VIEW or expose a mock fallback", () => {
  mockAuth.user.permissions = [];
  const get = jest.spyOn(adminBillingEvidenceClient, "get");
  mount();
  expect(screen.getByRole("alert")).toHaveTextContent("PARTNERS_VIEW");
  expect(get).not.toHaveBeenCalled();
});
