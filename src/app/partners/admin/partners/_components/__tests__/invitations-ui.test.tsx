import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/tokenStore";
import { adminInvitationsClient } from "@/features/partners/api/admin-invitations.api";
import { UNOPENED_INVITATIONS_MOCK } from "@/features/partners/mocks/unopened-invitations.mock";
import { ADMIN_USER_A } from "@/features/partners/test-utils/admin-partners.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { clearAdminCapabilityDenials } from "@/features/partners/utils/admin-capability-session-state";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { InvitePartnerDialog } from "../invite-partner-dialog";
import { UnopenedInvitationsTable } from "../../../cola/_components/unopened-invitations-table";
import { InvitationQueueSection } from "../../../cola/_components/invitation-queue-section";
let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
jest.mock("@/features/partners/utils/admin-command-idempotency", () => ({
  resolveAdminCommandIdempotencyKey: () => Promise.resolve("stable-ui-invitation-key"),
}));
let client: QueryClient;
function mount(component: React.ReactNode) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}
beforeEach(() => {
  mockAuth = {
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"] },
    accessToken: "captured-A",
  };
  tokenStore.set(mockAuth.accessToken);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
});
afterEach(() => {
  cleanup();
  client?.clear();
  jest.restoreAllMocks();
  tokenStore.set(null);
  clearAdminCapabilityDenials();
  clearAdminReadDenial();
});
it("queues an actual invitation, pins retry input on lost reply and never calls it sent or active", async () => {
  const receipt = {
    invitationId: UNOPENED_INVITATIONS_MOCK[0].id,
    state: "QUEUED",
    createdAt: "2026-10-12T00:00:00Z",
  };
  const post = jest
    .spyOn(adminInvitationsClient, "post")
    .mockRejectedValueOnce(buildAxiosError())
    .mockResolvedValueOnce({ data: receipt });
  const close = jest.fn();
  mount(<InvitePartnerDialog isOpen onClose={close} />);
  expect(screen.queryByText(/Opción sugerida|40%|70%/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nombre / marca"), { target: { value: "Test partner" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invite@example.test" } });
  await userEvent.click(screen.getByRole("button", { name: "Encolar invitación" }));
  const retry = await screen.findByRole("button", { name: "Reintentar misma invitación" });
  expect(screen.getByLabelText("Email")).toBeDisabled();
  await userEvent.click(retry);
  await screen.findByText(/Invitación encolada\. No es confirmación/);
  expect(close).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(2);
  for (const [, body, options] of post.mock.calls) {
    expect(body).toEqual({
      email: "invite@example.test",
      displayName: "Test partner",
      country: "PE",
      profile: "AGENCY",
    });
    expect(options?.headers).toEqual({
      Authorization: "Bearer captured-A",
      "Idempotency-Key": "stable-ui-invitation-key",
    });
  }
});
it("shows disabled transport honestly and requires a reason for persisted resend", async () => {
  const item = UNOPENED_INVITATIONS_MOCK[0];
  const post = jest
    .spyOn(adminInvitationsClient, "post")
    .mockRejectedValueOnce(buildAxiosError())
    .mockResolvedValueOnce({
      data: { invitationId: item.id, state: "QUEUED", queuedAt: "2026-10-12T00:00:00Z" },
    });
  mount(<UnopenedInvitationsTable invitations={[item]} isLoading={false} />);
  expect(screen.getByText(/Correo pendiente de configuración/)).toBeInTheDocument();
  expect(screen.queryByText(/correo enviado hace/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Encolar reenvío" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo del reenvío"), {
    target: { value: "Requested by recipient" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Encolar reenvío" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar mismo reenvío" }));
  await screen.findByText(/Reenvío encolado, no entrega confirmada/);
  expect(post.mock.calls.map((call) => call[1])).toEqual([
    { reason: "Requested by recipient" },
    { reason: "Requested by recipient" },
  ]);
});
it("loads actual list/cursor independently of write authority and does not display legacy mock cache", async () => {
  mockAuth.user.permissions = ["PARTNERS_VIEW"];
  const get = jest
    .spyOn(adminInvitationsClient, "get")
    .mockResolvedValueOnce({
      data: { items: UNOPENED_INVITATIONS_MOCK, nextCursor: "actual_next" },
    })
    .mockResolvedValueOnce({ data: { items: [], nextCursor: null } });
  mount(<InvitationQueueSection />);
  await screen.findByText("Test-only invitation");
  expect(screen.queryByRole("button", { name: /reenvío/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cargar más invitaciones" }));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(get).toHaveBeenLastCalledWith(
    expect.stringContaining("/admin/invitations"),
    expect.objectContaining({ params: { state: "ALL", cursor: "actual_next", limit: 20 } }),
  );
});
it.each([401, 403, 503])(
  "renders real list failure HTTP%i without example invitations",
  async (status) => {
    jest.spyOn(adminInvitationsClient, "get").mockRejectedValue(buildAxiosError(status));
    mount(<InvitationQueueSection />);
    await screen.findByRole("alert");
    expect(screen.queryByText("Test-only invitation")).not.toBeInTheDocument();
  },
);
it.each(["FAILED", "EXPIRED"] as const)(
  "allows a recovery resend of %s, but never of ACCEPTED",
  async (state) => {
    const item = { ...UNOPENED_INVITATIONS_MOCK[0], state, acceptancePending: state !== "EXPIRED" };
    const post = jest
      .spyOn(adminInvitationsClient, "post")
      .mockResolvedValue({
        data: { invitationId: item.id, state: "QUEUED", queuedAt: "2026-10-12T00:00:00Z" },
      });
    mount(<UnopenedInvitationsTable invitations={[item]} isLoading={false} />);
    fireEvent.change(screen.getByLabelText("Motivo del reenvío"), {
      target: { value: "Recipient requested fresh link" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Encolar reenvío" }));
    await screen.findByText(/Reenvío encolado, no entrega confirmada/);
    expect(post).toHaveBeenCalledTimes(1);
  },
);
