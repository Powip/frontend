import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/tokenStore";
import { adminInvitationsClient } from "@/features/partners/api/admin-invitations.api";
import { ADMIN_USER_A, ADMIN_USER_B } from "@/features/partners/test-utils/admin-partners.fixture";
import { InvitationAcceptanceContent } from "../invitation-acceptance-content";
const token = "A".repeat(43);
let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
jest.mock("@/features/partners/utils/admin-command-idempotency", () => ({
  resolveAdminCommandIdempotencyKey: () => Promise.resolve("stable-accept-key"),
}));
let client: QueryClient;
function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <InvitationAcceptanceContent />
      </QueryClientProvider>
    </StrictMode>,
  );
}
beforeEach(() => {
  mockAuth = { user: { id: ADMIN_USER_A, permissions: [] }, accessToken: "captured-A" };
  tokenStore.set(mockAuth.accessToken);
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", `/partners/invitacion#token=${token}`);
});
afterEach(() => {
  cleanup();
  client?.clear();
  jest.restoreAllMocks();
  tokenStore.set(null);
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});
it("never consumes on GET/render, strips the fragment and explicitly accepts using the real session", async () => {
  const receipt = {
    invitationId: "33333333-3333-4333-8333-333333333333",
    state: "ACCEPTED",
    acceptedAt: "2026-10-12T00:00:00Z",
  };
  const post = jest.spyOn(adminInvitationsClient, "post").mockResolvedValue({ data: receipt });
  mount();
  expect(window.location.hash).toBe("");
  expect(post).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain(token);
  expect(sessionStorage.length + localStorage.length).toBe(0);
  await userEvent.click(screen.getByRole("button", { name: "Aceptar invitación" }));
  await screen.findByText(/Invitación aceptada por tu cuenta/);
  expect(post).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/invitations/accept",
    { token },
    expect.objectContaining({
      headers: { Authorization: "Bearer captured-A", "Idempotency-Key": "stable-accept-key" },
    }),
  );
  expect(screen.getByRole("link", { name: /Continuar con la solicitud/ })).toHaveAttribute(
    "href",
    "/partners/solicitud",
  );
});
it.each(["#token=bad", `#token=${token}&owner=${ADMIN_USER_B}`, "", `?token=${token}`])(
  "fails closed without a canonical opaque fragment: %#",
  async (fragment) => {
    window.history.replaceState(null, "", `/partners/invitacion${fragment}`);
    const post = jest.spyOn(adminInvitationsClient, "post");
    mount();
    expect(screen.getByRole("button", { name: "Aceptar invitación" })).toBeDisabled();
    await screen.findByRole("alert");
    expect(post).not.toHaveBeenCalled();
  },
);
it("retries the same token/key after a lost response without storing raw token", async () => {
  const post = jest
    .spyOn(adminInvitationsClient, "post")
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockResolvedValueOnce({
      data: {
        invitationId: "33333333-3333-4333-8333-333333333333",
        state: "ACCEPTED",
        acceptedAt: "2026-10-12T00:00:00Z",
      },
    });
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Aceptar invitación" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar misma aceptación" }));
  await screen.findByText(/Invitación aceptada por tu cuenta/);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0][1]).toEqual(post.mock.calls[1][1]);
});
it("drops the in-memory invitation on session switch and ignores late acceptance", async () => {
  let resolve!: (value: unknown) => void;
  const post = jest.spyOn(adminInvitationsClient, "post").mockReturnValueOnce(
    new Promise((accept) => {
      resolve = accept;
    }),
  );
  const mounted = mount();
  await userEvent.click(screen.getByRole("button", { name: "Aceptar invitación" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  const signal = post.mock.calls[0][2]?.signal;
  mockAuth = { user: { id: ADMIN_USER_B, permissions: [] }, accessToken: "captured-B" };
  tokenStore.set(mockAuth.accessToken);
  mounted.rerender(
    <StrictMode>
      <QueryClientProvider client={client}>
        <InvitationAcceptanceContent />
      </QueryClientProvider>
    </StrictMode>,
  );
  await screen.findByRole("alert");
  expect(signal?.aborted).toBe(true);
  resolve({
    data: {
      invitationId: "33333333-3333-4333-8333-333333333333",
      state: "ACCEPTED",
      acceptedAt: "2026-10-12T00:00:00Z",
    },
  });
  await waitFor(() =>
    expect(screen.queryByText(/Invitación aceptada por tu cuenta/)).not.toBeInTheDocument(),
  );
});
