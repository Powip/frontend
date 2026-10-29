/** @jest-environment node */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { requestReferralRejection } from "../../api/referral-rejection.api";
import { ADMIN_USER_A } from "../../test-utils/admin-partners.fixture";
import { useReferralRejection } from "../use-referral-rejection";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        permissions: ["PARTNERS_RESOLVE_REFERRAL"],
      },
      accessToken: "private-SSR",
    },
  }),
}));
jest.mock("../../api/referral-rejection.api", () => ({ requestReferralRejection: jest.fn() }));
it("SSR cannot dispatch or persist a private rejection despite permission hints", () => {
  const client = new QueryClient();
  function Fixture() {
    const write = useReferralRejection();
    return <p>{`${write.session.enabled}:${write.session.userId}`}</p>;
  }
  expect(
    renderToString(
      <QueryClientProvider client={client}>
        <Fixture />
      </QueryClientProvider>,
    ),
  ).toContain(`false:${ADMIN_USER_A}`);
  expect(requestReferralRejection).not.toHaveBeenCalled();
  client.clear();
});
