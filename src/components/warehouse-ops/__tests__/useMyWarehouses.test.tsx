/**
 * Tests: almacenes del usuario (FEAT-24 H6) — `useMyWarehouses` y `useOperationKeys`.
 *
 * 1. Con asignaciones filtra lo que ve y lo que opera; sin asignaciones o si /me/warehouses falla, no filtra.
 * 2. La clave de idempotencia de una acción es la misma en cada reintento hasta liberarla.
 */

import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { useOperationKeys } from "@/hooks/useOperationKeys";
import { getMyWarehouses } from "@/services/userWarehousesService";
import { WAREHOUSES } from "./fixtures";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1", role: "ALMACEN" } } }),
}));
jest.mock("@/services/userWarehousesService", () => ({ getMyWarehouses: jest.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

beforeEach(() => jest.clearAllMocks());

describe("useMyWarehouses", () => {
  it("con asignaciones: ve w-1 y w-2, opera solo w-2", async () => {
    jest.mocked(getMyWarehouses).mockResolvedValue({ all: false, inventoryIds: ["w-1", "w-2"], operableIds: ["w-2"] });
    const { result } = renderHook(() => useMyWarehouses(), { wrapper });
    await waitFor(() => expect(result.current.known).toBe(true));
    expect(ids(result.current.visible(WAREHOUSES))).toEqual(["w-1", "w-2"]);
    expect(ids(result.current.operable(WAREHOUSES))).toEqual(["w-2"]);
    expect(result.current.canSee("w-3")).toBe(false);
    expect(result.current.canOperate("w-1")).toBe(false);
    expect(result.current.canOperate("w-2")).toBe(true);
  });

  it("sin asignaciones ve y opera todos", async () => {
    jest.mocked(getMyWarehouses).mockResolvedValue({ all: true, inventoryIds: ["w-1", "w-2", "w-3"], operableIds: ["w-1", "w-2", "w-3"] });
    const { result } = renderHook(() => useMyWarehouses(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(ids(result.current.operable(WAREHOUSES))).toEqual(["w-1", "w-2", "w-3"]);
  });

  it("si /me/warehouses falla no filtra (el backend igual valida)", async () => {
    jest.mocked(getMyWarehouses).mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useMyWarehouses(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.known).toBe(false);
    expect(ids(result.current.visible(WAREHOUSES))).toEqual(["w-1", "w-2", "w-3"]);
    expect(result.current.canOperate("w-3")).toBe(true);
  });
});

describe("useOperationKeys", () => {
  it("la misma acción reintenta con la misma clave; liberada, la próxima es otra", () => {
    const { result, rerender } = renderHook(() => useOperationKeys());
    const first = result.current.get("dispatch:t-1");
    rerender();
    expect(result.current.get("dispatch:t-1")).toBe(first);
    expect(result.current.get("dispatch:t-2")).not.toBe(first);
    act(() => result.current.release("dispatch:t-1"));
    expect(result.current.get("dispatch:t-1")).not.toBe(first);
  });
});
