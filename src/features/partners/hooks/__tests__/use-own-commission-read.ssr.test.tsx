/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "../../api/commission-read.api";
import { useOwnCommissionEvaluations, useOwnCommissionItems } from "../use-own-commission-read";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "11111111-1111-4111-8111-111111111111" }, accessToken: "server-private" },
  }),
}));
jest.mock("../../api/commission-read.api", () => ({
  requestOwnCommissionItems: jest.fn(),
  requestOwnCommissionEvaluations: jest.fn(),
}));
it("SSR never fetches either evidence endpoint or stores secret/identity epochs", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Probe() {
    const items = useOwnCommissionItems();
    const evaluations = useOwnCommissionEvaluations();
    expect(items.session.enabled).toBe(false);
    expect(evaluations.session.epoch).toBe(0);
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
    expect(requestOwnCommissionItems).not.toHaveBeenCalled();
    expect(requestOwnCommissionEvaluations).not.toHaveBeenCalled();
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
