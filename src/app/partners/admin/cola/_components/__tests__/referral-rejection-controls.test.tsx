import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { referralRejectionClient } from "@/features/partners/api/referral-rejection.api";
import type { AdminReviewQueueItem } from "@/features/partners/models/admin-review-queue";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  ADMIN_USER_B,
} from "@/features/partners/test-utils/admin-partners.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { clearAdminCapabilityDenials } from "@/features/partners/utils/admin-capability-session-state";
import {
  clearAdminReadDenial,
  denyAdminReadSession,
} from "@/features/partners/utils/admin-read-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { ReferralRejectionControls } from "../referral-rejection-controls";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
const item: AdminReviewQueueItem = {
  id: "33333333-3333-4333-8333-333333333333",
  partnerId: ADMIN_PARTNER_ID,
  partnerDisplayName: "Actual partner",
  partnerStatus: "SUSPENDED",
  origin: "CODE",
  state: "CAPTURED",
  version: 4,
  businessName: "Actual lead",
  capturedAt: "2026-10-10T12:00:00Z",
  expiresAt: null,
};
const confirmed = {
  id: item.id,
  partnerId: item.partnerId,
  origin: item.origin,
  state: "CANCELLED",
  decision: "REJECTED",
  version: 5,
  decidedAt: "2026-10-11T12:00:00Z",
};
let client: QueryClient;
function mount(
  items: AdminReviewQueueItem[] = [item],
  reload = jest.fn<Promise<AdminReviewQueueItem[]>, []>().mockResolvedValue([item]),
) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ReferralRejectionControls items={items} reload={reload} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    reload,
    replace: (actual: AdminReviewQueueItem[]) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <ReferralRejectionControls items={actual} reload={reload} />
        </QueryClientProvider>,
      ),
  };
}
async function propose() {
  await userEvent.selectOptions(screen.getByLabelText("Referido a rechazar"), item.id);
  fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
    target: { value: " Private rejection reason " },
  });
  await userEvent.click(screen.getByRole("button", { name: "Rechazar referido" }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  clearAdminReadDenial();
  clearAdminCapabilityDenials();
  sessionStorage.clear();
  mockAuth = {
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_RESOLVE_REFERRAL"] },
    accessToken: "UI-private-A",
  };
  tokenStore.set(mockAuth.accessToken);
});
afterEach(() => {
  cleanup();
  client?.clear();
  jest.restoreAllMocks();
  clearAdminReadDenial();
  clearAdminCapabilityDenials();
  tokenStore.set(null);
  sessionStorage.clear();
});

it.each(["PARTNERS_VIEW", "PARTNERS_APPROVE", "PARTNERS_MANAGE_PARTNERS", "ROLE_SUPERADMIN"])(
  "%s never exposes rejection or dispatches",
  (permission) => {
    mockAuth.user.permissions = [permission];
    const post = jest.spyOn(referralRejectionClient, "post");
    mount();
    expect(screen.queryByRole("button", { name: "Rechazar referido" })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  },
);

it("requires explicit target and reason, then submits exactly persisted version/reason with no positive or financial action", async () => {
  const post = jest.spyOn(referralRejectionClient, "post").mockResolvedValue({ data: confirmed });
  mount();
  expect(screen.getByRole("button", { name: "Rechazar referido" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /Aprobar|Asignar|Invitar|Confirmar pago|Bloquear/ }),
  ).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Referido a rechazar"), item.id);
  expect(screen.getByLabelText("Motivo del rechazo")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Motivo del rechazo"), { target: { value: "a\nb" } });
  await userEvent.click(screen.getByRole("button", { name: "Rechazar referido" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("1000 caracteres");
  expect(post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
    target: { value: " Private rejection reason " },
  });
  await userEvent.click(screen.getByRole("button", { name: "Rechazar referido" }));
  await screen.findByText(/Rechazo confirmado/);
  expect(post).toHaveBeenCalledWith(
    `https://partners.review.invalid/v1/partners/admin/review-queue/${item.id}/reject`,
    { expectedVersion: 4, reason: "Private rejection reason" },
    expect.objectContaining({
      headers: { Authorization: "Bearer UI-private-A", "Idempotency-Key": expect.any(String) },
    }),
  );
  expect(screen.getByLabelText("Motivo del rechazo")).toHaveValue("");
});

it("lost response survives removal/background queue version, close/reopen and repeats exact original command/key", async () => {
  const post = jest
    .spyOn(referralRejectionClient, "post")
    .mockRejectedValueOnce(buildAxiosError())
    .mockResolvedValue({ data: confirmed });
  const view = mount();
  await propose();
  await screen.findByRole("button", { name: "Reintentar mismo rechazo" });
  view.replace([{ ...item, version: 7 }]);
  expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(
    "Private rejection reason",
  );
  expect(screen.getByLabelText("Motivo de la solicitud original")).toBeDisabled();
  expect(screen.queryByLabelText("Referido a rechazar")).not.toBeInTheDocument();
  view.replace([]);
  expect(screen.getByRole("status")).toHaveTextContent("desconocido");
  expect(screen.queryByText(/Rechazo confirmado/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cerrar control de rechazo" }));
  expect(screen.queryByLabelText("Motivo de la solicitud original")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Recuperar solicitud de rechazo" }));
  await userEvent.click(screen.getByRole("button", { name: "Reintentar mismo rechazo" }));
  await screen.findByText(/Rechazo confirmado/);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0][1]).toEqual({ expectedVersion: 4, reason: "Private rejection reason" });
  expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
  expect(post.mock.calls[1][2]?.headers).toEqual(post.mock.calls[0][2]?.headers);
  expect(view.reload).not.toHaveBeenCalled();
});

it("a definitive CAS error adopts a new baseline only after successful explicit GET, failed GET keeps original proposal", async () => {
  const post = jest
    .spyOn(referralRejectionClient, "post")
    .mockRejectedValueOnce(buildAxiosError(409))
    .mockResolvedValue({ data: { ...confirmed, version: 8 } });
  const reload = jest
    .fn<Promise<AdminReviewQueueItem[]>, []>()
    .mockRejectedValueOnce(buildAxiosError(503))
    .mockResolvedValueOnce([{ ...item, version: 7 }]);
  const view = mount([item], reload);
  await propose();
  await screen.findByRole("button", { name: "Revisar cola antes de nueva solicitud" });
  view.replace([{ ...item, version: 6 }]);
  await userEvent.click(
    screen.getByRole("button", { name: "Revisar cola antes de nueva solicitud" }),
  );
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(
    "Private rejection reason",
  );
  expect(screen.queryByLabelText("Referido a rechazar")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Revisar cola antes de nueva solicitud" }),
    ).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Revisar cola antes de nueva solicitud" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Versión del referido elegido: 7")).toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Motivo del rechazo")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
    target: { value: "New deliberate reason" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Rechazar referido" }));
  await screen.findByText(/Rechazo confirmado/);
  expect(post.mock.calls[1][1]).toEqual({ expectedVersion: 7, reason: "New deliberate reason" });
  expect(post.mock.calls[1][2]?.headers?.["Idempotency-Key"]).not.toBe(
    post.mock.calls[0][2]?.headers?.["Idempotency-Key"],
  );
});

it.each([401, 403])("HTTP%i purges reason/action and never displays a success", async (status) => {
  jest.spyOn(referralRejectionClient, "post").mockRejectedValue(buildAxiosError(status));
  mount();
  await propose();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Rechazar referido" })).not.toBeInTheDocument(),
  );
  expect(screen.queryByLabelText("Motivo de la solicitud original")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reintentar mismo rechazo" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Rechazo confirmado/)).not.toBeInTheDocument();
});

it("external 401 cancels pending POST; old success cannot acknowledge or expose its reason", async () => {
  const pending = deferred<{ data: typeof confirmed }>();
  const post = jest.spyOn(referralRejectionClient, "post").mockReturnValue(pending.promise);
  mount();
  await propose();
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  const signal = post.mock.calls[0][2]?.signal;
  act(() => denyAdminReadSession(ADMIN_USER_A, "UI-private-A", buildAxiosError(401)));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => pending.resolve({ data: confirmed }));
  expect(screen.queryByText(/Rechazo confirmado/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Motivo de la solicitud original")).not.toBeInTheDocument();
});

it("identity change clears in-memory private proposal and prevents the previous HTTP callback from acknowledging", async () => {
  const pending = deferred<{ data: typeof confirmed }>();
  const post = jest.spyOn(referralRejectionClient, "post").mockReturnValue(pending.promise);
  const view = mount();
  await propose();
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  mockAuth = {
    user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW", "PARTNERS_RESOLVE_REFERRAL"] },
    accessToken: "UI-private-B",
  };
  tokenStore.set(mockAuth.accessToken);
  view.replace([item]);
  expect(screen.getByLabelText("Motivo del rechazo")).toHaveValue("");
  await act(async () => pending.resolve({ data: confirmed }));
  expect(screen.queryByText(/Rechazo confirmado/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reintentar mismo rechazo" }),
  ).not.toBeInTheDocument();
});

it("version MAX blocks a new rejection but MAX-1 lost-response replay remains available", async () => {
  const post = jest
    .spyOn(referralRejectionClient, "post")
    .mockRejectedValueOnce(buildAxiosError())
    .mockResolvedValue({ data: { ...confirmed, version: Number.MAX_SAFE_INTEGER } });
  const view = mount([{ ...item, version: Number.MAX_SAFE_INTEGER - 1 }]);
  await propose();
  await screen.findByRole("button", { name: "Reintentar mismo rechazo" });
  view.replace([{ ...item, version: Number.MAX_SAFE_INTEGER }]);
  await userEvent.click(screen.getByRole("button", { name: "Reintentar mismo rechazo" }));
  await screen.findByText(/Rechazo confirmado/);
  await userEvent.selectOptions(screen.getByLabelText("Referido a rechazar"), item.id);
  expect(screen.getByRole("button", { name: "Rechazar referido" })).toBeDisabled();
  expect(post.mock.calls[0][1]).toEqual(
    expect.objectContaining({ expectedVersion: Number.MAX_SAFE_INTEGER - 1 }),
  );
  expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
});
