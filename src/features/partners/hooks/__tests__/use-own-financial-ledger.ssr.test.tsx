/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestOwnFinancialBalance,
  requestOwnFinancialLedger,
} from "../../api/financial-ledger.api";
import { useOwnFinancialBalance, useOwnFinancialLedger } from "../use-own-financial-ledger";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "11111111-1111-4111-8111-111111111111" }, accessToken: "server-private" },
  }),
}));
jest.mock("../../api/financial-ledger.api", () => ({
  requestOwnFinancialLedger: jest.fn(),
  requestOwnFinancialBalance: jest.fn(),
}));

it("SSR never fetches ledger or balance, including forced cache fetches, and has no secret epoch", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Probe() {
    const ledger = useOwnFinancialLedger();
    const balance = useOwnFinancialBalance();
    expect(ledger.session.enabled).toBe(false);
    expect(balance.session.enabled).toBe(false);
    expect(ledger.session.epoch).toBe(0);
    expect(balance.session.epoch).toBe(0);
    expect(ledger.data).toBeUndefined();
    expect(balance.data).toBeUndefined();
    return null;
  }
  tokenStore.set("server-private");
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    const queries = client.getQueryCache().getAll();
    expect(queries).toHaveLength(2);
    for (const query of queries) await expect(query.fetch()).rejects.toBeInstanceOf(CancelledError);
    expect(requestOwnFinancialLedger).not.toHaveBeenCalled();
    expect(requestOwnFinancialBalance).not.toHaveBeenCalled();
    expect(JSON.stringify(queries.map((query) => query.queryKey))).not.toContain("server-private");
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
