import React, { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import MetricsLayout from "../layout";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/ui/select", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Select: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
      <button aria-label="Alcance del reporte" onClick={() => onValueChange(value === "business" ? "store" : "business")}>{value}</button>
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
  render(<MetricsLayout><Report /></MetricsLayout>);
  expect(screen.getByText("business:empty,web")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Alcance del reporte" }));
  expect(screen.getByText("store:empty")).toBeInTheDocument();
});

it("conserva la elección entre reportes y limpia los detalles al cambiar de reporte", () => {
  const view = render(<MetricsLayout><Report /></MetricsLayout>);
  fireEvent.click(screen.getByRole("button", { name: "Alcance del reporte" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir detalle" }));
  expect(screen.getByText("Detalle abierto")).toBeInTheDocument();
  session = { ...session, selectedStoreId: "web" };
  mockPathname.mockReturnValue("/metricas/operaciones");
  view.rerender(<MetricsLayout><Report /></MetricsLayout>);
  expect(screen.getByText("store:web")).toBeInTheDocument();
  expect(screen.queryByText("Detalle abierto")).not.toBeInTheDocument();
});

it("mantiene vendedores en su tienda sin selector de negocio", () => {
  session.auth!.user.role = "VENTAS";
  render(<MetricsLayout><Report /></MetricsLayout>);
  expect(screen.getByText("store:empty")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Alcance del reporte" })).not.toBeInTheDocument();
});

it("espera una sesión válida antes de montar el reporte", () => {
  session = { ...session, auth: null, loading: true };
  render(<MetricsLayout><Report /></MetricsLayout>);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando sesión");
  expect(screen.queryByRole("button", { name: "Abrir detalle" })).not.toBeInTheDocument();
});

it("deja las métricas globales de superadministrador fuera del filtro por negocio", () => {
  mockPathname.mockReturnValue("/metricas/superadmin");
  render(<MetricsLayout><p>Métricas globales</p></MetricsLayout>);
  expect(screen.getByText("Métricas globales")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Alcance del reporte" })).not.toBeInTheDocument();
});
