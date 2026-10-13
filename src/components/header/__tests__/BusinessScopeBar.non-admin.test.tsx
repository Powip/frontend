import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import { BusinessScopeBar } from "../BusinessScopeBar";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ usePathname: () => "/ventas" }));

const mockUseAuth = jest.mocked(useAuth);
let authState: ReturnType<typeof useAuth>;

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  if (!window.PointerEvent) window.PointerEvent = MouseEvent as typeof PointerEvent;
});

beforeEach(() => {
  authState = {
    auth: {
      accessToken: "operative-session",
      user: { id: "operative", email: "operative@example.test", role: "VENTAS", permissions: [] },
      company: {
        id: "company-a", name: "Negocio A",
        stores: [{ id: "store-empty", name: "Tienda vacía" }, { id: "store-web", name: "WEB" }],
      },
      subscription: null, exp: 9999999999,
    },
    selectedStoreId: "store-empty",
    setSelectedStore: jest.fn((storeId: string) => { authState = { ...authState, selectedStoreId: storeId }; }),
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateCompany: jest.fn(),
    inventories: [],
    refreshInventories: jest.fn(),
    hasPermission: jest.fn(),
    refreshSubscription: jest.fn(),
    refreshSession: jest.fn(),
  };
  mockUseAuth.mockImplementation(() => authState);
});

function ScopeView() {
  const { storeIds } = useBusinessScope();
  return <><BusinessScopeBar /><output aria-label="Tiendas consultadas">{storeIds.join(",")}</output></>;
}

it.each(["VENTAS", "ALMACEN"])("offers the complete company by default to %s and allows an explicit store selection", async (role) => {
  authState.auth!.user.role = role;
  render(<BusinessScopeProvider><ScopeView /></BusinessScopeProvider>);
  const user = userEvent.setup();
  const trigger = screen.getByRole("combobox", { name: "Ver datos de" });

  expect(trigger).toHaveTextContent("Todo el negocio");
  expect(screen.getByLabelText("Tiendas consultadas")).toHaveTextContent("store-empty,store-web");
  expect(authState.setSelectedStore).not.toHaveBeenCalled();

  await user.click(trigger);
  expect(screen.getByRole("option", { name: "Todo el negocio" })).toBeInTheDocument();
  await user.click(screen.getByRole("option", { name: "WEB" }));
  expect(authState.setSelectedStore).toHaveBeenCalledWith("store-web");
  expect(trigger).toHaveTextContent("WEB");
  expect(screen.getByLabelText("Tiendas consultadas")).toHaveTextContent(/^store-web$/);

  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Todo el negocio" }));
  expect(trigger).toHaveTextContent("Todo el negocio");
  expect(screen.getByLabelText("Tiendas consultadas")).toHaveTextContent("store-empty,store-web");
  expect(authState.selectedStoreId).toBe("store-web");
});
