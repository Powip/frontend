/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import { requestAdminPartnerStatus } from "../../api/admin-partner-status.api";
import { useAdminPartnerStatus } from "../use-admin-partner-status";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        permissions: ["PARTNERS_MANAGE_PARTNERS"],
      },
      accessToken: "server-private",
    },
  }),
}));
jest.mock("../../api/admin-partner-status.api", () => ({ requestAdminPartnerStatus: jest.fn() }));

it("never sends a status operation during SSR", async () => {
  const client = new QueryClient();
  let rendered: ReturnType<typeof useAdminPartnerStatus> | null = null;
  function Probe() {
    rendered = useAdminPartnerStatus();
    return null;
  }
  tokenStore.set("server-private");
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    if (!rendered) throw new Error("SSR probe did not render");
    const result = rendered as ReturnType<typeof useAdminPartnerStatus>;
    expect(result.session.enabled).toBe(false);
    await expect(
      result.mutation.mutateAsync({
        input: {
          partnerId: "11111111-1111-4111-8111-111111111111",
          operation: "suspend",
          command: { expectedVersion: 4, reason: "Private reason" },
        },
        epoch: 0,
      }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(requestAdminPartnerStatus).not.toHaveBeenCalled();
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
