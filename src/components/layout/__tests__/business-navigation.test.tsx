import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AppContainer from "../AppContainer";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";

let mockPathname = "/operaciones";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({
  auth: { accessToken: "session", user: { id: "owner", email: "owner@example.com", role: "ADMINISTRADOR" }, company: { id: "company", stores: [{ id: "empty", name: "KUNCA" }, { id: "web", name: "WEB" }] } },
  selectedStoreId: "empty",
}) }));
jest.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => <nav /> }));
jest.mock("@/components/auth/AuthGuard", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/header/BusinessScopeBar", () => ({ BusinessScopeBar: () => {
  const { useBusinessScope: useScope } = jest.requireActual("@/contexts/BusinessScopeContext");
  const { scope, setScope } = useScope();
  return <button onClick={() => setScope(scope === "business" ? "store" : "business")}>Cambiar alcance</button>;
} }));

function View() {
  const { scope, storeIds } = useBusinessScope();
  const [selected, setSelected] = useState(false);
  return <><p>{`${scope}:${storeIds.join(",")}`}</p><button onClick={() => setSelected(true)}>Seleccionar pedido</button>{selected && <p>Pedido seleccionado</p>}</>;
}

it("shares one choice across Operations and Sales and clears selections when the scope changes", () => {
  mockPathname = "/operaciones";
  const view = render(<AppContainer><View /></AppContainer>);
  expect(screen.getByText("business:empty,web")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Seleccionar pedido"));
  fireEvent.click(screen.getByText("Cambiar alcance"));
  expect(screen.getByText("store:empty")).toBeInTheDocument();
  expect(screen.queryByText("Pedido seleccionado")).not.toBeInTheDocument();
  mockPathname = "/ventas";
  view.rerender(<AppContainer><View /></AppContainer>);
  expect(screen.getByText("store:empty")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Cambiar alcance"));
  expect(screen.getByText("business:empty,web")).toBeInTheDocument();
});
