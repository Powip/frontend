/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestAdminFinancialBalance,
  requestAdminFinancialLedger,
} from "../../api/financial-ledger.api";
import { ledgerEntryFixture } from "../../test-utils/financial-ledger.fixture";
import { useAdminFinancialBalance, useAdminFinancialLedger } from "../use-admin-financial-ledger";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: ["PARTNERS_VIEW"] },
      accessToken: "server-private",
    },
  }),
}));
jest.mock("../../api/financial-ledger.api", () => ({
  requestAdminFinancialLedger: jest.fn(),
  requestAdminFinancialBalance: jest.fn(),
}));
it("SSR never fetches scoped admin ledger or balance even with forced query fetches", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Probe() {
    const ledger = useAdminFinancialLedger(ledgerEntryFixture.partnerId);
    const balance = useAdminFinancialBalance(ledgerEntryFixture.partnerId);
    expect(ledger.session.enabled).toBe(false);
    expect(balance.session.enabled).toBe(false);
    expect(ledger.session.epoch).toBe(0);
    expect(balance.session.epoch).toBe(0);
    return null;
  }
  tokenStore.set("server-private");
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    for (const query of client.getQueryCache().getAll())
      await expect(query.fetch()).rejects.toBeInstanceOf(CancelledError);
    expect(requestAdminFinancialLedger).not.toHaveBeenCalled();
    expect(requestAdminFinancialBalance).not.toHaveBeenCalled();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain("server-private");
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
