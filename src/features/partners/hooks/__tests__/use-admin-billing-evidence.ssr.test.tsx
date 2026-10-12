/** @jest-environment node */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestAdminBillingEvidence,
  requestAdminBillingEvidenceDetail,
} from "../../api/admin-billing-evidence.api";
import {
  useAdminBillingEvidence,
  useAdminBillingEvidenceDetail,
} from "../use-admin-billing-evidence";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: ["PARTNERS_VIEW"] },
      accessToken: "private-SSR-bearer",
    },
  }),
}));
jest.mock("../../api/admin-billing-evidence.api", () => ({
  requestAdminBillingEvidence: jest.fn(),
  requestAdminBillingEvidenceDetail: jest.fn(),
}));
it("does not fetch or put a bearer into shared SSR cache keys", () => {
  const client = new QueryClient();
  function Probe() {
    useAdminBillingEvidence();
    useAdminBillingEvidenceDetail("11111111-1111-4111-8111-111111111111");
    return null;
  }
  tokenStore.set("private-SSR-bearer");
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    expect(requestAdminBillingEvidence).not.toHaveBeenCalled();
    expect(requestAdminBillingEvidenceDetail).not.toHaveBeenCalled();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain("private-SSR-bearer");
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
