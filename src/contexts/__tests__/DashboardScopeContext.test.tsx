import React, { type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { useAuth } from "../AuthContext";
import { DashboardScopeProvider, useDashboardScope } from "../DashboardScopeContext";

jest.mock("../AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);
let authState: ReturnType<typeof useAuth>;

const Wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardScopeProvider>{children}</DashboardScopeProvider>
);
const wrapper = Wrapper;

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

  it.each(["VENTAS", "ALMACEN", "ATENCION_CLIENTE"])("inicia %s con todas las tiendas de su empresa sin cambiar el destino", (role) => {
    authState.auth!.user.role = role;
    const { result } = renderHook(() => useDashboardScope(), { wrapper });

    expect(result.current.scope).toBe("business");
    expect(result.current.canViewBusiness).toBe(true);
    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
    expect(result.current.canFetch).toBe(true);
    expect(authState.setSelectedStore).not.toHaveBeenCalled();
    expect(authState.selectedStoreId).toBe("store-kunca");

    act(() => result.current.setScope("store"));
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });
    act(() => result.current.setScope("business"));
    expect(result.current.scope).toBe("business");
  });

  it("permite consultar una tienda y sigue sus cambios antes de volver al negocio", () => {
    authState.auth!.user.role = "VENTAS";
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
    authState.auth!.user.role = "ALMACEN";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));
    const originalSession = authState;

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

    authState = originalSession;
    rerender();
    expect(result.current.scope).toBe("business");
    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
  });

  it("carga el alcance del negocio cuando termina de restaurarse la sesión", () => {
    authState.auth!.user.role = "ATENCION_CLIENTE";
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

    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
    act(() => result.current.setScope("store"));
    expect(result.current.storeIds).toEqual([]);
    expect(result.current.scopeParams).toEqual({ storeId: "" });
    expect(result.current.canFetch).toBe(false);
  });

  it("no vuelve a filtrar una tienda al cambiar rol o dejar de ser superadministrador", () => {
    authState.auth!.user.role = "VENTAS";
    authState.auth!.user.email = "joel@aranni.com.pe";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.scope).toBe("business");

    authState.auth!.user.email = "seller@example.com";
    authState.auth!.user.role = "ALMACEN";
    rerender();
    expect(result.current.scope).toBe("business");
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
  });

  it("reinicia la elección al cambiar usuario y no revive la de una sesión anterior", () => {
    authState.auth!.user.role = "VENTAS";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));
    const originalSession = authState;
    authState = { ...authState, auth: { ...authState.auth!, user: { ...authState.auth!.user, id: "other-user" } } };
    rerender();
    expect(result.current.scope).toBe("business");
    expect(result.current.storeIds).toEqual(["store-cod", "store-empty", "store-kunca"]);
    authState = originalSession;
    rerender();
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
  });

  it("cierra las consultas al salir y no permite cambiar la elección sin sesión", () => {
    authState.auth!.user.role = "VENTAS";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));
    const originalSession = authState;
    authState = { ...authState, auth: null, selectedStoreId: null };
    rerender();
    expect(result.current.canFetch).toBe(false);
    expect(result.current.canViewBusiness).toBe(false);
    expect(result.current.storeIds).toEqual([]);
    act(() => result.current.setScope("business"));
    authState = originalSession;
    rerender();
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
  });

  it("conserva la tienda explícita al renovar token, datos de empresa o rol en la misma sesión", () => {
    authState.auth!.user.role = "VENTAS";
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));
    authState = {
      ...authState,
      auth: {
        ...authState.auth!,
        accessToken: "refreshed-test-token",
        company: { ...authState.auth!.company! },
        user: { ...authState.auth!.user, role: "ALMACEN" },
      },
    };
    rerender();
    expect(result.current.scope).toBe("store");
    expect(result.current.scopeParams).toEqual({ storeId: "store-kunca" });
    expect(result.current.canFetch).toBe(true);
  });

  it.each(["token", "user", "company"])("descarta la elección al perder %s antes de volver a iniciar sesión", (missing) => {
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    act(() => result.current.setScope("store"));
    const originalSession = authState;
    authState = {
      ...authState,
      auth: {
        ...authState.auth!,
        accessToken: missing === "token" ? "" : authState.auth!.accessToken,
        user: { ...authState.auth!.user, id: missing === "user" ? "" : authState.auth!.user.id },
        company: missing === "company" ? null : authState.auth!.company,
      },
    };
    rerender();
    expect(result.current.canFetch).toBe(false);
    act(() => result.current.setScope("store"));
    authState = originalSession;
    rerender();
    expect(result.current.scope).toBe("business");
    expect(result.current.scopeParams).toEqual({ storeIds: "store-cod,store-empty,store-kunca" });
  });

  it.each(["token", "user", "company"])("no permite guardar alcance sin %s y recupera el valor predeterminado al iniciar sesión", (missing) => {
    const restoredSession = authState;
    authState = {
      ...authState,
      auth: {
        ...authState.auth!,
        accessToken: missing === "token" ? "" : authState.auth!.accessToken,
        user: { ...authState.auth!.user, id: missing === "user" ? "" : authState.auth!.user.id },
        company: missing === "company" ? null : authState.auth!.company,
      },
    };
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.canFetch).toBe(false);
    expect(result.current.canViewBusiness).toBe(false);
    act(() => result.current.setScope("store"));
    authState = restoredSession;
    rerender();
    expect(result.current.scope).toBe("business");
    expect(result.current.canFetch).toBe(true);
  });
});
