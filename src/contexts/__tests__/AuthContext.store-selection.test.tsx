import React, { type ReactNode } from "react";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { decodeToken } from "@/lib/jwt";
import { fetchUserCompany } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import { StoreSwitcher } from "@/components/selector/store-switcher";
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

const mockAxios = jest.mocked(axios);
const mockDecodeToken = jest.mocked(decodeToken);
const mockFetchUserCompany = jest.mocked(fetchUserCompany);
const mockFetchUserSubscription = jest.mocked(fetchUserSubscription);

const company = {
  id: "company-kunca",
  userId: "owner-kunca",
  name: "Kunca",
  stores: [
    { id: "store-kunca", name: "KUNCA" },
    { id: "store-cod", name: "Kunca COD - web" },
  ],
};

const Wrapper = ({ children }: { children: ReactNode }) => {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreSwitcher />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
};

const restoreSession = async () => {
  const hook = renderHook(() => useAuth(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.auth?.company?.id).toBe(company.id);
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockAxios.post.mockResolvedValue({ data: { accessToken: "session-token" } });
  mockAxios.get.mockResolvedValue({ data: [] });
  mockDecodeToken.mockReturnValue({
    id: "owner-kunca",
    email: "owner@example.com",
    role: "ADMINISTRADOR",
    permissions: [],
    companyId: company.id,
    exp: 9999999999,
    iat: 1,
  });
  mockFetchUserCompany.mockResolvedValue(company);
  mockFetchUserSubscription.mockResolvedValue(null);
});

describe("selección de tienda del negocio", () => {
  it("normaliza almacenes store_id del API y excluye los de otra tienda", async () => {
    mockAxios.get.mockResolvedValue({ data: [
      { id: "physical", name: "Almacén", store_id: "store-kunca" },
      { id: "camel", name: "Otro almacén", storeId: "store-kunca" },
      { id: "foreign", name: "Ajeno", store_id: "store-other-business" },
    ] });
    const { result } = await restoreSession();
    await waitFor(() => expect(result.current.inventories).toHaveLength(2));
    expect(result.current.inventories.map((inventory) => inventory.storeId)).toEqual(["store-kunca", "store-kunca"]);
  });

  it("reemplaza una preferencia ajena y alinea el selector con las consultas", async () => {
    localStorage.setItem("selectedStoreId", "store-other-business");

    const { result } = await restoreSession();

    expect(result.current.selectedStoreId).toBe("store-kunca");
    expect(screen.getByText("KUNCA")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-kunca");
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/inventory/store/store-kunca"),
      expect.objectContaining({ headers: { Authorization: "Bearer session-token" }, signal: expect.any(AbortSignal) }),
    );
    expect(
      mockAxios.get.mock.calls.every(
        ([url]) => !String(url).includes("store-other-business"),
      ),
    ).toBe(true);
  });

  it("conserva una preferencia válida del negocio actual", async () => {
    localStorage.setItem("selectedStoreId", "store-cod");

    const { result } = await restoreSession();

    expect(result.current.selectedStoreId).toBe("store-cod");
    expect(screen.getByText("Kunca COD - web")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-cod");
  });

  it("persiste un cambio de tienda y lo recupera al abrir otra sesión", async () => {
    const firstSession = await restoreSession();

    await act(async () => firstSession.result.current.setSelectedStore("store-cod"));

    expect(firstSession.result.current.selectedStoreId).toBe("store-cod");
    expect(screen.getByText("Kunca COD - web")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-cod");
    firstSession.unmount();

    const secondSession = await restoreSession();
    expect(secondSession.result.current.selectedStoreId).toBe("store-cod");
  });

  it("ignora selecciones de tiendas fuera del negocio", async () => {
    const { result } = await restoreSession();

    await act(async () => result.current.setSelectedStore("store-other-business"));

    expect(result.current.selectedStoreId).toBe("store-kunca");
    expect(screen.getByText("KUNCA")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-kunca");
  });

  it("reconcilia una tienda eliminada y limpia la selección si no quedan tiendas", async () => {
    localStorage.setItem("selectedStoreId", "store-cod");
    const { result } = await restoreSession();

    await act(async () => result.current.updateCompany({
      ...company,
      stores: [company.stores[0]],
    }));

    expect(result.current.selectedStoreId).toBe("store-kunca");
    expect(screen.getByText("KUNCA")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-kunca");

    await act(async () => result.current.updateCompany({ ...company, stores: [] }));

    expect(result.current.selectedStoreId).toBeNull();
    expect(screen.queryByText("Tienda activa")).not.toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBeNull();
  });

  it("usa una tienda del nuevo negocio cuando se actualiza la compañía", async () => {
    const { result } = await restoreSession();

    await act(async () => result.current.updateCompany({
      id: "company-new",
      name: "Nuevo negocio",
      stores: [{ id: "store-new", name: "Nueva tienda" }],
    }));

    expect(result.current.selectedStoreId).toBe("store-new");
    expect(screen.getByText("Nueva tienda")).toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBe("store-new");
  });

  it("limpia la preferencia anterior al iniciar sesión en un negocio sin tiendas", async () => {
    const { result } = await restoreSession();
    mockFetchUserCompany.mockResolvedValue({ ...company, id: "empty-business", stores: [] });

    await act(async () => {
      await result.current.login({ accessToken: "new-session-token" });
    });

    expect(result.current.auth?.company?.id).toBe("empty-business");
    expect(result.current.selectedStoreId).toBeNull();
    expect(screen.queryByText("Tienda activa")).not.toBeInTheDocument();
    expect(localStorage.getItem("selectedStoreId")).toBeNull();
  });
});
