/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import { requestAdminCommissionPolicyVersions, requestCreateAdminCommissionPolicyDraft } from "../../api/admin-commission-policy.api";
import { requestAdminResources } from "../../api/admin-resources.api";
import { POLICY_COMMAND, WRITE_USER_A } from "../../test-utils/admin-writes.fixture";
import { adminCapabilityDenialSnapshot, denyAdminCapability, getAdminCapabilityDenial } from "../../utils/admin-capability-session-state";
import { useAdminCommissionPolicies } from "../use-admin-commission-policies";
import { useAdminResources } from "../use-admin-resources";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: ["PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"] }, accessToken: "server-private-bearer" } }) }));
jest.mock("../../api/admin-commission-policy.api", () => ({ requestAdminCommissionPolicyVersions: jest.fn(), requestCreateAdminCommissionPolicyDraft: jest.fn() }));
jest.mock("../../api/admin-resources.api", () => ({ requestAdminResources: jest.fn() }));

it("disables both capability families during SSR and never populates shared denial/session identity", async () => {
  const client = new QueryClient();
  let rendered: { policy: ReturnType<typeof useAdminCommissionPolicies>; resources: ReturnType<typeof useAdminResources> } | null = null;
  function Probe() { rendered = { policy: useAdminCommissionPolicies(), resources: useAdminResources() }; return null; }
  tokenStore.set("server-private-bearer");
  try {
    renderToString(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    if (!rendered) throw new Error("SSR probe did not render");
    const result = rendered as { policy: ReturnType<typeof useAdminCommissionPolicies>; resources: ReturnType<typeof useAdminResources> };
    expect(result.policy.session.enabled).toBe(false); expect(result.resources.session.enabled).toBe(false);
    expect(result.policy.session.epoch).toBe(0);
    await expect(result.policy.creation.mutateAsync({ command: POLICY_COMMAND, epoch: 0 })).rejects.toBeInstanceOf(CancelledError);
    for (const query of client.getQueryCache().getAll()) await expect(query.fetch()).rejects.toBeInstanceOf(CancelledError);
    denyAdminCapability("policy", WRITE_USER_A, 0, new Error("server-request-only"));
    expect(adminCapabilityDenialSnapshot()).toBe(0);
    expect(getAdminCapabilityDenial("policy", WRITE_USER_A, 0)).toBeNull();
    expect(requestAdminCommissionPolicyVersions).not.toHaveBeenCalled(); expect(requestCreateAdminCommissionPolicyDraft).not.toHaveBeenCalled(); expect(requestAdminResources).not.toHaveBeenCalled();
  } finally { client.clear(); tokenStore.set(null); }
});
