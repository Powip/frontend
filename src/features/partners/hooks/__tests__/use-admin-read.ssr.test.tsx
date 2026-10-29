/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { useAdminReadSession } from "../use-admin-read-session";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", permissions: ["PARTNERS_VIEW"] },
      accessToken: "fixture-server-token",
    },
  }),
}));

it("disables admin reads during SSR and never dispatches an authenticated request", async () => {
  let session: ReturnType<typeof useAdminReadSession> | null = null;
  function Probe() {
    session = useAdminReadSession();
    return null;
  }
  const client = new QueryClient();
  renderToString(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
  if (!session) throw new Error("SSR hook did not render");
  const rendered = session as ReturnType<typeof useAdminReadSession>;
  expect(rendered.enabled).toBe(false);
  expect(rendered.epoch).toBe(0);
  const request = jest.fn().mockResolvedValue({ privateData: "must not be requested" });
  await expect(rendered.read(new AbortController().signal, request)).rejects.toBeInstanceOf(
    CancelledError,
  );
  expect(request).not.toHaveBeenCalled();
  client.clear();
});
