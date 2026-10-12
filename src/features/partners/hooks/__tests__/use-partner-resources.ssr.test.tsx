/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../../keys/partners.keys";
import { getPartnerResources } from "../../services/get-partner-resources";
import { usePartnerResources } from "../use-partner-resources";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCESS_TOKEN = "fixture-server-resources-token";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      accessToken: "fixture-server-resources-token",
    },
  }),
}));
jest.mock("../../services/get-partner-resources", () => ({ getPartnerResources: jest.fn() }));

it("disables resources during SSR and guards even an explicitly requested fetch", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let resources: ReturnType<typeof usePartnerResources> | null = null;
  function Probe() {
    resources = usePartnerResources();
    return null;
  }
  tokenStore.set(ACCESS_TOKEN);
  try {
    renderToString(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    if (!resources) throw new Error("Resources SSR hook did not render");
    const rendered = resources as ReturnType<typeof usePartnerResources>;
    expect(rendered.fetchStatus).toBe("idle");
    expect(rendered.data).toBeUndefined();
    const query = client.getQueryCache().getAll()[0];
    expect(rendered.isEnabled).toBe(false);
    expect(query.queryKey).toEqual(partnersKeys.resources(USER_ID, 0));
    await expect(query.fetch()).rejects.toBeInstanceOf(CancelledError);
    expect(getPartnerResources).not.toHaveBeenCalled();
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
