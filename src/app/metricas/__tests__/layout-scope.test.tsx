import React, { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardScopeProvider, useDashboardScope } from "@/contexts/DashboardScopeContext";
import MetricsLayout from "../layout";
import { BusinessScopeBar } from "@/components/header/BusinessScopeBar";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/ui/select", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Select: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
      <button aria-label="Ver datos de" onClick={() => onValueChange(value === "business" ? "empty" : "business")}>{value}</button>
    ),
    SelectContent: Container, SelectItem: Container, SelectTrigger: Container, SelectValue: Container,
  };
});

let session: ReturnType<typeof useAuth>;
const mockUseAuth = jest.mocked(useAuth);
const mockPathname = jest.mocked(usePathname);

function Report() {
  const { scope, storeIds } = useDashboardScope();
  const [expanded, setExpanded] = useState(false);
  return <div><p>{`${scope}:${storeIds.join(",")}`}</p><button onClick={() => setExpanded(true)}>Abrir detalle</button>{expanded && <p>Detalle abierto</p>}</div>;
}

beforeEach(() => {
  mockPathname.mockReturnValue("/metricas/ventas");
  session = {
    auth: {
      accessToken: "test-token", user: { id: "owner", email: "owner@example.com", role: "ADMINISTRADOR", permissions: [] },
      company: { id: "business", name: "Negocio", stores: [{ id: "empty", name: "KUNCA" }, { id: "web", name: "Web COD" }] },
      subscription: null, exp: 9999999999,
    },
    selectedStoreId: "empty", loading: false, login: jest.fn(), logout: jest.fn(), setSelectedStore: jest.fn(),
    updateCompany: jest.fn(), inventories: [], refreshInventories: jest.fn(), hasPermission: jest.fn(), refreshSession: jest.fn(), refreshSubscription: jest.fn(),
  };
  mockUseAuth.mockImplementation(() => session);
});

it("comparte el negocio por defecto y permite elegir la tienda vacía", () => {
  render(<DashboardScopeProvider><BusinessScopeBar /><MetricsLayout><Report /></MetricsLayout></DashboardScopeProvider>);
  expect(screen.getByText("business:empty,web")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver datos de" }));
  expect(screen.getByText("store:empty")).toBeInTheDocument();
});

it("conserva la elección entre reportes y limpia los detalles al cambiar de reporte", () => {
  const view = render(<DashboardScopeProvider><BusinessScopeBar /><MetricsLayout><Report /></MetricsLayout></DashboardScopeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Ver datos de" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir detalle" }));
  expect(screen.getByText("Detalle abierto")).toBeInTheDocument();
  session = { ...session, selectedStoreId: "web" };
  mockPathname.mockReturnValue("/metricas/operaciones");
  view.rerender(<DashboardScopeProvider><BusinessScopeBar /><MetricsLayout><Report /></MetricsLayout></DashboardScopeProvider>);
  expect(screen.getByText("store:web")).toBeInTheDocument();
  expect(screen.queryByText("Detalle abierto")).not.toBeInTheDocument();
});

it("mantiene vendedores en su tienda sin selector de negocio", () => {
  session.auth!.user.role = "VENTAS";
  render(<DashboardScopeProvider><BusinessScopeBar /><MetricsLayout><Report /></MetricsLayout></DashboardScopeProvider>);
  expect(screen.getByText("store:empty")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ver datos de" })).toHaveTextContent("empty");
});

it("espera una sesión válida antes de montar el reporte", () => {
  session = { ...session, auth: null, loading: true };
  render(<DashboardScopeProvider><BusinessScopeBar /><MetricsLayout><Report /></MetricsLayout></DashboardScopeProvider>);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando sesión");
  expect(screen.queryByRole("button", { name: "Abrir detalle" })).not.toBeInTheDocument();
});

it("deja las métricas globales de superadministrador fuera del filtro por negocio", () => {
  mockPathname.mockReturnValue("/metricas/superadmin");
  render(<DashboardScopeProvider><MetricsLayout><p>Métricas globales</p></MetricsLayout></DashboardScopeProvider>);
  expect(screen.getByText("Métricas globales")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver datos de" })).not.toBeInTheDocument();
});

it("identifica los catálogos empresariales sin ofrecer un filtro por tienda", () => {
  mockPathname.mockReturnValue("/clientes");
  render(<DashboardScopeProvider><BusinessScopeBar /></DashboardScopeProvider>);
  expect(screen.getByText("Datos de todo el negocio")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver datos de" })).not.toBeInTheDocument();
});
