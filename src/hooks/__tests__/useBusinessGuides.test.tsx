import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import axiosAuth from "@/lib/axiosAuth";
import { useBusinessGuides } from "../useBusinessGuides";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, selectedStoreId: mockSelectedStoreId }),
}));

interface TestGuide {
  id: string;
  storeId: string;
  orderIds: string[];
  quotedAmount?: number;
}

type Session = {
  accessToken: string;
  user: { id: string; role: string };
  company: { id: string; stores: { id: string; name: string }[] };
};

let mockAuth: Session | null;
let mockSelectedStoreId: string | null;
let guideData: Record<string, TestGuide[]>;
let orderData: Record<string, { id: string; storeId: string }[]>;

const ownA: TestGuide = { id: "guide-a", storeId: "store-a", orderIds: ["a-1"] };
const shared: TestGuide = { id: "guide-shared", storeId: "store-a", orderIds: ["a-2", "b-1"], quotedAmount: 40 };
const ownB: TestGuide = { id: "guide-b", storeId: "store-b", orderIds: ["b-2"] };
const ownC: TestGuide = { id: "guide-c", storeId: "store-c", orderIds: ["c-1"] };

function session(): Session {
  return {
    accessToken: "token-a",
    user: { id: "operative-a", role: "ALMACEN" },
    company: {
      id: "company-a",
      stores: ["store-b", "store-a", "store-c", "store-b"].map((id) => ({ id, name: id })),
    },
  };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <BusinessScopeProvider>{children}</BusinessScopeProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function useScopedGuides(options?: { includeAllStores?: boolean }) {
  const guides = useBusinessGuides<TestGuide>(options);
  const { scope, setScope } = useBusinessScope();
  return { ...guides, scope, setScope };
}

function respond(url: string) {
  const storeId = url.split("/").pop()!;
  if (url.includes("/shipping-guides/store/")) return { data: guideData[storeId] ?? [] };
  if (url.includes("/order-header/store/")) return { data: orderData[storeId] ?? [] };
  throw new Error(`URL inesperada: ${url}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = session();
  mockSelectedStoreId = "store-b";
  guideData = { "store-a": [ownA, shared], "store-b": [ownB], "store-c": [ownC] };
  orderData = {
    "store-a": [{ id: "a-1", storeId: "store-a" }, { id: "a-2", storeId: "store-a" }],
    "store-b": [{ id: "b-1", storeId: "store-b" }, { id: "b-2", storeId: "store-b" }],
    "store-c": [{ id: "c-1", storeId: "store-c" }],
  };
  jest.mocked(axiosAuth.get).mockReset().mockImplementation(async (url) => respond(url));
});

it("consulta cada tienda autorizada una vez y deduplica las guías del negocio sin cargar pedidos", async () => {
  guideData["store-b"].push(shared);
  const { result } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toEqual([ownA, shared, ownB, ownC]));

  const requests = jest.mocked(axiosAuth.get).mock.calls;
  expect(requests.map(([url]) => url.split("/").pop())).toEqual(["store-a", "store-b", "store-c"]);
  for (const [url, config] of requests) {
    expect(url).toContain("/shipping-guides/store/");
    expect(config?.headers).toEqual({ Authorization: "Bearer token-a" });
    expect(config?.signal).toBeInstanceOf(AbortSignal);
  }
});

it("muestra la guía compartida desde su tienda propietaria y desde la tienda de un pedido incluido", async () => {
  const { result, rerender } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.loading).toBe(false));

  act(() => result.current.setScope("store"));
  await waitFor(() => expect(result.current.guides).toEqual([shared, ownB]));
  // La guía sigue siendo una unidad: sus pedidos e importe no se recortan.
  expect(result.current.guides[0]).toEqual(shared);

  mockSelectedStoreId = "store-a";
  rerender();
  await waitFor(() => expect(result.current.guides).toEqual([ownA, shared]));

  mockSelectedStoreId = "store-c";
  rerender();
  await waitFor(() => expect(result.current.guides).toEqual([ownC]));
  expect(jest.mocked(axiosAuth.get).mock.calls.filter(([url]) => url.includes("/shipping-guides/store/"))).toHaveLength(3);
});

it("includeAllStores ofrece guías de otras tiendas del mismo negocio aun en vista tienda", async () => {
  const { result } = renderHook(() => useScopedGuides({ includeAllStores: true }), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toHaveLength(4));
  act(() => result.current.setScope("store"));

  expect(result.current.guides).toEqual([ownA, shared, ownB, ownC]);
  expect(axiosAuth.get).toHaveBeenCalledTimes(3);
  expect(result.current.error).toBe(false);
});

it("espera los pedidos del scope antes de mostrar una lista incompleta", async () => {
  let finishOrders!: (response: { data: typeof orderData[string] }) => void;
  jest.mocked(axiosAuth.get).mockImplementation((url) => url.includes("/order-header/store/")
    ? new Promise((resolve) => { finishOrders = resolve; })
    : Promise.resolve(respond(url)));
  const { result } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toHaveLength(4));

  act(() => result.current.setScope("store"));
  expect(result.current.loading).toBe(true);
  expect(result.current.guides).toEqual([]);
  await act(async () => { finishOrders({ data: orderData["store-b"] }); });
  await waitFor(() => expect(result.current.guides).toEqual([shared, ownB]));
});

it("combina errores de pedidos y reintenta ambas consultas sin cambiar la firma de refetch", async () => {
  let failOrders = true;
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (failOrders && url.includes("/order-header/store/")) throw new Error("Pedidos no disponibles");
    return respond(url);
  });
  const { result } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toHaveLength(4));
  act(() => result.current.setScope("store"));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.guides).toEqual([]);

  failOrders = false;
  jest.mocked(axiosAuth.get).mockClear();
  await act(async () => {
    const response = await result.current.refetch({ cancelRefetch: false });
    expect(response.data).toEqual([ownA, shared, ownB, ownC]);
  });
  await waitFor(() => expect(result.current.guides).toEqual([shared, ownB]));
  expect(result.current.error).toBe(false);
  expect(axiosAuth.get).toHaveBeenCalledTimes(4);

  jest.mocked(axiosAuth.get).mockClear();
  await act(async () => { await result.current.retry(); });
  expect(axiosAuth.get).toHaveBeenCalledTimes(4);
});

it("reporta error si una tienda no devuelve sus guías, sin presentar un total parcial", async () => {
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => {
    if (url.endsWith("/store-c")) throw new Error("401");
    return respond(url);
  });
  const { result } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.guides).toEqual([]);
});

it.each(["company", "user"])("no reutiliza guías de una identidad anterior al cambiar %s", async (identity) => {
  const { result, rerender } = renderHook(() => useScopedGuides(), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toHaveLength(4));
  const pending: (() => void)[] = [];
  jest.mocked(axiosAuth.get).mockImplementation(() => new Promise((resolve) => {
    pending.push(() => resolve({ data: [] }));
  }));
  mockAuth = {
    ...mockAuth!,
    accessToken: "new-token",
    company: { ...mockAuth!.company, id: identity === "company" ? "company-b" : "company-a" },
    user: { ...mockAuth!.user, id: identity === "user" ? "operative-b" : "operative-a" },
  };
  rerender();
  expect(result.current.guides).toEqual([]);
  expect(result.current.loading).toBe(true);
  await act(async () => { pending.forEach((resolve) => resolve()); });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.guides).toEqual([]);
});

it("no consulta sin sesión autorizada, incluso al solicitar refetch explícito", async () => {
  mockAuth = null;
  const { result } = renderHook(() => useScopedGuides({ includeAllStores: true }), { wrapper: setup() });
  await act(async () => { await result.current.refetch(); });
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(result.current.guides).toEqual([]);
  expect(result.current.loading).toBe(false);
});

it("respeta canFetch cuando la tienda seleccionada no pertenece al catálogo autorizado", async () => {
  const { result, rerender } = renderHook(() => useScopedGuides({ includeAllStores: true }), { wrapper: setup() });
  await waitFor(() => expect(result.current.guides).toHaveLength(4));
  act(() => result.current.setScope("store"));
  mockSelectedStoreId = "foreign-store";
  rerender();
  jest.mocked(axiosAuth.get).mockClear();

  expect(result.current.guides).toEqual([]);
  await act(async () => { await result.current.refetch(); });
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);

  // Un refetch deshabilitado no debe vaciar la caché autorizada del negocio.
  mockSelectedStoreId = "store-b";
  rerender();
  await waitFor(() => expect(result.current.guides).toEqual([ownA, shared, ownB, ownC]));
});
