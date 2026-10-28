import React, { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { decodeToken } from "@/lib/jwt";
import { fetchUserCompany } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import { listWarehouses, type CompanyWarehouse, type CompanyWarehouses } from "@/services/warehousesService";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("axios");
jest.mock("@/lib/jwt", () => ({ decodeToken: jest.fn() }));
jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn(),
  fetchCompanyById: jest.fn(),
}));
jest.mock("@/services/fetchUserSubscription", () => ({
  fetchUserSubscription: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const mockAxios = jest.mocked(axios);
const mockDecodeToken = jest.mocked(decodeToken);
const mockFetchUserCompany = jest.mocked(fetchUserCompany);
const mockFetchUserSubscription = jest.mocked(fetchUserSubscription);
const mockListWarehouses = jest.mocked(listWarehouses);

const company = {
  id: "company-1",
  userId: "owner-1",
  name: "Negocio",
  stores: [
    { id: "store-a", name: "Tienda A" },
    { id: "store-b", name: "Tienda B" },
  ],
};

const warehouse = (id: string, storeId: string, overrides: Partial<CompanyWarehouse> = {}): CompanyWarehouse => ({
  id,
  name: `Almacén ${id}`,
  status: true,
  store_id: storeId,
  company_id: company.id,
  type: "PROPIO",
  is_main: false,
  ...overrides,
});

const catalog = (
  warehouses: CompanyWarehouse[],
  links: CompanyWarehouses["links"],
): CompanyWarehouses => ({ warehouses, links });

const link = (storeId: string, inventoryId: string, isDefault = true) => ({
  store_id: storeId,
  inventory_id: inventoryId,
  is_default: isDefault,
});

/** Respuesta de GET /inventory/store/:id por tienda (los almacenes que la tienda posee). */
let ownedByStore: Record<string, Array<{ id: string; name: string; store_id: string }>> = {};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const Wrapper = ({ children }: { children: ReactNode }) => {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

const restoreSession = async () => {
  const hook = renderHook(() => useAuth(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.selectedStoreId).toBe("store-a");
  return hook;
};

const ids = (inventories: Array<{ id: string }>) => inventories.map((inventory) => inventory.id);

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  ownedByStore = {};
  consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockAxios.post.mockResolvedValue({ data: { accessToken: "session-token" } });
  mockAxios.get.mockImplementation(async (url: string) => {
    const storeId = String(url).split("/inventory/store/")[1];
    return { data: ownedByStore[storeId] ?? [] };
  });
  mockDecodeToken.mockReturnValue({
    id: "owner-1",
    email: "owner@example.com",
    role: "ADMINISTRADOR",
    permissions: [],
    companyId: company.id,
    exp: 9999999999,
    iat: 1,
  });
  mockFetchUserCompany.mockResolvedValue(company);
  mockFetchUserSubscription.mockResolvedValue(null);
  mockListWarehouses.mockResolvedValue(catalog([], []));
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("almacenes de la tienda seleccionada en el contexto", () => {
  it("tienda dueña de su almacén y sin vínculo distinto: igual que hoy", async () => {
    ownedByStore["store-a"] = [{ id: "wh-a", name: "Almacén A", store_id: "store-a" }];
    mockListWarehouses.mockResolvedValue(
      catalog([warehouse("wh-a", "store-a")], [link("store-a", "wh-a", false), link("store-b", "wh-a")]),
    );

    const { result } = await restoreSession();

    await waitFor(() => expect(result.current.inventories).toHaveLength(1));
    await waitFor(() => expect(mockListWarehouses).toHaveBeenCalledTimes(1));
    expect(result.current.inventories[0]).toEqual(expect.objectContaining({ id: "wh-a", name: "Almacén A", storeId: "store-a" }));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("tienda sin almacén propio y con uno por defecto de otra tienda: aparece con el storeId del dueño", async () => {
    ownedByStore["store-a"] = [];
    mockListWarehouses.mockResolvedValue(
      catalog([warehouse("wh-main", "store-b", { name: "Principal", is_main: true })], [link("store-a", "wh-main")]),
    );

    const { result } = await restoreSession();

    await waitFor(() => expect(result.current.inventories).toHaveLength(1));
    expect(result.current.inventories[0]).toEqual({ id: "wh-main", name: "Principal", storeId: "store-b" });
  });

  it("tienda con almacén propio y por defecto distinto: ambos, el propio primero", async () => {
    ownedByStore["store-a"] = [{ id: "wh-own", name: "Propio", store_id: "store-a" }];
    mockListWarehouses.mockResolvedValue(
      catalog(
        [warehouse("wh-main", "store-b", { name: "Principal" }), warehouse("wh-own", "store-a", { name: "Propio" })],
        [link("store-a", "wh-main"), link("store-a", "wh-own", false)],
      ),
    );

    const { result } = await restoreSession();

    await waitFor(() => expect(result.current.inventories).toHaveLength(2));
    expect(ids(result.current.inventories)).toEqual(["wh-own", "wh-main"]);
    expect(result.current.inventories.map((inventory) => inventory.storeId)).toEqual(["store-a", "store-b"]);
  });

  it("el mismo almacén como propio y por defecto aparece una sola vez", async () => {
    ownedByStore["store-a"] = [{ id: "wh-a", name: "Almacén A", store_id: "store-a" }];
    mockListWarehouses.mockResolvedValue(catalog([warehouse("wh-a", "store-a")], [link("store-a", "wh-a")]));

    const { result } = await restoreSession();

    await waitFor(() => expect(mockListWarehouses).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-a"]));
  });

  it("si listWarehouses rechaza, quedan solo los propios y se registra el error", async () => {
    ownedByStore["store-a"] = [{ id: "wh-own", name: "Propio", store_id: "store-a" }];
    mockListWarehouses.mockRejectedValue(new Error("ms-products no responde"));

    const { result } = await restoreSession();

    await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(consoleError).toHaveBeenCalledWith(
      "No se pudo consultar el almacén por defecto de la tienda",
      expect.any(Error),
    );
    expect(ids(result.current.inventories)).toEqual(["wh-own"]);
  });

  it("si listWarehouses rechaza y la tienda no tiene propios, la lista queda vacía", async () => {
    ownedByStore["store-a"] = [];
    mockListWarehouses.mockRejectedValue(new Error("ms-products no responde"));

    const { result } = await restoreSession();

    await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(result.current.inventories).toEqual([]);
  });

  it("no incluye un almacén por defecto inactivo ni vínculos de otra tienda o no marcados como por defecto", async () => {
    ownedByStore["store-a"] = [];
    mockListWarehouses.mockResolvedValue(
      catalog(
        [
          warehouse("wh-inactive", "store-b", { status: false }),
          warehouse("wh-other-store", "store-b"),
          warehouse("wh-not-default", "store-b"),
        ],
        [link("store-a", "wh-inactive"), link("store-b", "wh-other-store"), link("store-a", "wh-not-default", false)],
      ),
    );

    const { result } = await restoreSession();

    await waitFor(() => expect(mockListWarehouses).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(result.current.inventories).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("si la consulta de los almacenes propios falla, no consulta los almacenes de la empresa y deja la lista vacía", async () => {
    mockAxios.get.mockRejectedValue(new Error("ms-logistics no responde"));

    const { result } = await restoreSession();

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Error loading inventories", expect.any(Error)));
    expect(mockListWarehouses).not.toHaveBeenCalled();
    expect(result.current.inventories).toEqual([]);
  });

  it("los propios aparecen sin esperar al almacén por defecto, que se suma al llegar", async () => {
    ownedByStore["store-a"] = [{ id: "wh-own", name: "Propio", store_id: "store-a" }];
    const pending = deferred<CompanyWarehouses>();
    mockListWarehouses.mockReturnValue(pending.promise);

    const { result } = await restoreSession();

    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-own"]));
    expect(mockListWarehouses).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(catalog([warehouse("wh-main", "store-b"), warehouse("wh-own", "store-a")], [link("store-a", "wh-main")]));
    });

    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-own", "wh-main"]));
  });

  it("refreshInventories vuelve a incluir el almacén por defecto", async () => {
    ownedByStore["store-a"] = [];
    mockListWarehouses.mockResolvedValue(catalog([warehouse("wh-main", "store-b")], [link("store-a", "wh-main")]));
    const { result } = await restoreSession();
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-main"]));

    await act(async () => result.current.refreshInventories());

    expect(mockListWarehouses).toHaveBeenCalledTimes(2);
    expect(ids(result.current.inventories)).toEqual(["wh-main"]);
  });

  it("al cambiar de tienda no quedan almacenes de la anterior", async () => {
    ownedByStore["store-a"] = [{ id: "wh-a", name: "Almacén A", store_id: "store-a" }];
    ownedByStore["store-b"] = [{ id: "wh-b", name: "Almacén B", store_id: "store-b" }];
    const storeAResponse = deferred<CompanyWarehouses>();
    mockListWarehouses
      .mockReturnValueOnce(storeAResponse.promise)
      .mockResolvedValue(catalog([warehouse("wh-a", "store-a"), warehouse("wh-b", "store-b"), warehouse("wh-main-a", "store-a")], [link("store-b", "wh-b")]));

    const { result } = await restoreSession();
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-a"]));

    await act(async () => result.current.setSelectedStore("store-b"));
    await waitFor(() => expect(result.current.selectedStoreId).toBe("store-b"));
    await waitFor(() => expect(mockListWarehouses).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-b"]));

    // La respuesta tardía de la tienda anterior ya no puede aplicarse.
    await act(async () => {
      storeAResponse.resolve(catalog([warehouse("wh-a", "store-a"), warehouse("wh-main-a", "store-a")], [link("store-a", "wh-main-a")]));
    });

    expect(ids(result.current.inventories)).toEqual(["wh-b"]);
    expect(result.current.inventories.every((inventory) => inventory.storeId === "store-b")).toBe(true);
  });

  it("al cambiar de tienda, el rechazo tardío de la tienda anterior no se registra ni cambia la lista", async () => {
    ownedByStore["store-a"] = [{ id: "wh-a", name: "Almacén A", store_id: "store-a" }];
    ownedByStore["store-b"] = [{ id: "wh-b", name: "Almacén B", store_id: "store-b" }];
    const storeAResponse = deferred<CompanyWarehouses>();
    mockListWarehouses
      .mockReturnValueOnce(storeAResponse.promise)
      .mockResolvedValue(catalog([warehouse("wh-b", "store-b")], []));

    const { result } = await restoreSession();
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-a"]));

    await act(async () => result.current.setSelectedStore("store-b"));
    await waitFor(() => expect(ids(result.current.inventories)).toEqual(["wh-b"]));

    await act(async () => {
      storeAResponse.reject(new Error("respuesta tardía"));
    });

    expect(ids(result.current.inventories)).toEqual(["wh-b"]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
