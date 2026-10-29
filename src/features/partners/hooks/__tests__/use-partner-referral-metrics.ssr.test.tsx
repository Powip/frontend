/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import { requestPartnerReferralMetrics } from "../../api/partner-referral-metrics.api";
import { usePartnerReferralMetrics } from "../use-partner-referral-metrics";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "11111111-1111-4111-8111-111111111111" }, accessToken: "server-private" },
  }),
}));
jest.mock("../../api/partner-referral-metrics.api", () => ({
  requestPartnerReferralMetrics: jest.fn(),
}));

it("does not fetch counts or store an identity epoch during SSR, including explicit query.fetch", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let rendered: ReturnType<typeof usePartnerReferralMetrics> | null = null;
  function Probe() {
    rendered = usePartnerReferralMetrics();
    return null;
  }
  tokenStore.set("server-private");
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    if (!rendered) throw new Error("SSR probe missing");
    const result = rendered as ReturnType<typeof usePartnerReferralMetrics>;
    expect(result.session.enabled).toBe(false);
    expect(result.session.epoch).toBe(0);
    expect(result.data).toBeUndefined();
    await expect(client.getQueryCache().getAll()[0].fetch()).rejects.toBeInstanceOf(CancelledError);
    expect(requestPartnerReferralMetrics).not.toHaveBeenCalled();
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
