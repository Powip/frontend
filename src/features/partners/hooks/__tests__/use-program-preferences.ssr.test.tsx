/** @jest-environment node */
import { CancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { tokenStore } from "@/lib/tokenStore";
import {
  requestProgramPreferences,
  requestUpdateProgramPreferences,
} from "../../api/program-preferences.api";
import { useProgramPreferences } from "../use-program-preferences";
import { useUpdateProgramPreferences } from "../use-update-program-preferences";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "11111111-1111-4111-8111-111111111111" }, accessToken: "server-private" },
  }),
}));
jest.mock("../../api/program-preferences.api", () => ({
  requestProgramPreferences: jest.fn(),
  requestUpdateProgramPreferences: jest.fn(),
}));

it("never reads, writes, stores bearer epochs or resolves retry keys during SSR", async () => {
  const client = new QueryClient();
  let rendered: {
    read: ReturnType<typeof useProgramPreferences>;
    write: ReturnType<typeof useUpdateProgramPreferences>;
  } | null = null;
  function Probe() {
    rendered = { read: useProgramPreferences(), write: useUpdateProgramPreferences() };
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
    const result = rendered as {
      read: ReturnType<typeof useProgramPreferences>;
      write: ReturnType<typeof useUpdateProgramPreferences>;
    };
    expect(result.read.session.enabled).toBe(false);
    expect(result.read.session.epoch).toBe(0);
    expect(result.read.data).toBeUndefined();
    await expect(
      result.write.mutation.mutateAsync({
        command: { optionCode: "A", discountPct: "0", expectedVersion: null, reason: "Private" },
        epoch: 0,
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(requestProgramPreferences).not.toHaveBeenCalled();
    expect(requestUpdateProgramPreferences).not.toHaveBeenCalled();
  } finally {
    client.clear();
    tokenStore.set(null);
  }
});
