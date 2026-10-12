import React, { type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { useAuth } from "../AuthContext";
import { DashboardScopeProvider, useDashboardScope } from "../DashboardScopeContext";

jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);
let authState: ReturnType<typeof useAuth>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardScopeProvider>{children}</DashboardScopeProvider>
);

beforeEach(() => {
  authState = {
    auth: {
      accessToken: "dashboard-test-token",
      user: {
        id: "owner-kunca",
        email: "owner@example.com",
        role: "ADMINISTRADOR",
        permissions: [],
      },
      company: {
        id: "company-kunca",
        name: "Kunca",
        stores: [
          { id: "store-kunca", name: "KUNCA" },
          { id: "store-cod", name: "Kunca COD - web" },
          { id: "store-empty", name: "Tienda sin pedidos" },
          { id: "store-cod", name: "Duplicado" },
        ],
      },
      subscription: null,
      exp: 9999999999,
    },
    selectedStoreId: "store-kunca",
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateCompany: jest.fn(),
    setSelectedStore: jest.fn(),
    inventories: [],
    refreshInventories: jest.fn(),
    hasPermission: jest.fn(),
    refreshSubscription: jest.fn(),
    refreshSession: jest.fn(),
  };
  mockUseAuth.mockImplementation(() => authState);
});

describe("DashboardScopeContext", () => {
  it("suma por defecto todas las tiendas del negocio, incluyendo tiendas sin pedidos", () => {
    const { result } = renderHook(() => useDashboardScope(), { wrapper });

    expect(result.current.scope).toBe("business");
    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
    expect(result.current.canFetch).toBe(true);
  });

  it("mantiene a VENTAS en la tienda seleccionada", () => {
    authState.auth!.user.role = "VENTAS";
    const { result } = renderHook(() => useDashboardScope(), { wrapper });

    expect(result.current.scope).toBe("store");
    expect(result.current.storeIds).toEqual(["store-kunca"]);
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });
    expect(result.current.canFetch).toBe(true);

    act(() => result.current.setScope("business"));
    expect(result.current.scope).toBe("store");
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });
  });

  it("permite consultar una tienda y sigue sus cambios antes de volver al negocio", () => {
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });

    act(() => result.current.setScope("store"));
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });

    authState = { ...authState, selectedStoreId: "store-cod" };
    rerender();
    expect(result.current.scopeParams).toEqual({ storeId: "store-cod" });

    act(() => result.current.setScope("business"));
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
  });

  it("deriva las tiendas del nuevo negocio y reinicia su vista predeterminada", () => {
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));

    authState = {
      ...authState,
      auth: {
        ...authState.auth!,
        company: {
          id: "company-new",
          name: "Nuevo negocio",
          stores: [{ id: "store-new", name: "Nueva tienda" }],
        },
      },
      selectedStoreId: "store-new",
    };
    rerender();

    expect(result.current.scope).toBe("business");
    expect(result.current.storeIds).toEqual(["store-new"]);
    expect(result.current.scopeParams).toEqual({ storeIds: "store-new" });
  });

  it("carga el alcance del negocio cuando termina de restaurarse la sesión", () => {
    const restoredSession = authState;
    authState = { ...authState, auth: null, selectedStoreId: null, loading: true };
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.canFetch).toBe(false);

    authState = restoredSession;
    rerender();

    expect(result.current.scope).toBe("business");
    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
    expect(result.current.canFetch).toBe(true);
  });

  it("impide consultas sin token, usuario o tiendas conocidas", () => {
    authState.auth!.accessToken = "";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.canFetch).toBe(false);

    authState.auth!.accessToken = "dashboard-test-token";
    authState.auth!.user.id = "";
    rerender();
    expect(result.current.canFetch).toBe(false);

    authState.auth!.user.id = "owner-kunca";
    authState.auth!.company!.stores = [];
    rerender();
    expect(result.current.canFetch).toBe(false);
    expect(result.current.storeIds).toEqual([]);
    expect(result.current.scopeParams).toEqual({ storeIds: "" });
  });

  it("excluye una tienda seleccionada ajena al negocio", () => {
    authState.auth!.user.role = "VENTAS";
    authState.selectedStoreId = "store-other-business";
    const { result } = renderHook(() => useDashboardScope(), { wrapper });

    expect(result.current.storeIds).toEqual([]);
    expect(result.current.scopeParams).toEqual({ storeId: "" });
    expect(result.current.canFetch).toBe(false);
  });

  it("respeta el acceso de superadministrador y cambios de rol", () => {
    authState.auth!.user.role = "VENTAS";
    authState.auth!.user.email = "joel@aranni.com.pe";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.scope).toBe("business");

    authState.auth!.user.email = "seller@example.com";
    rerender();
    expect(result.current.scope).toBe("store");
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });
  });
});
