import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import AppContainer from "../AppContainer";

const publicCatalog = "/live/ee2f3613-9735-4c56-a73e-88ed264a4c1d";
let mockPathname = publicCatalog;
let mockAuth: { user: { id: string }; company: { id: string } } | null = null;
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({
  BusinessScopeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useBusinessScope: () => ({ scopeKey: "fixture-scope" }),
}));
jest.mock("@/components/auth/AuthGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => <nav>Panel privado</nav> }));
jest.mock("@/components/subscription/FlowMigrationBanner", () => ({
  __esModule: true, default: () => <p>Banner Flow</p>,
}));
jest.mock("@/components/header/BusinessScopeBar", () => ({ BusinessScopeBar: () => <p>Alcance</p> }));

function CustomerForm() {
  const [name, setName] = useState("");
  return <input aria-label="Nombre del comprador" value={name} onChange={(event) => setName(event.target.value)} />;
}
beforeEach(() => { mockPathname = publicCatalog; mockAuth = null; });

test("catalog excludes private chrome and preserves the buyer form during silent session recovery", () => {
  const view = render(<AppContainer><CustomerForm /></AppContainer>);
  fireEvent.change(screen.getByLabelText("Nombre del comprador"), { target: { value: "Cliente" } });
  mockAuth = { user: { id: "user-a" }, company: { id: "company-a" } };
  view.rerender(<AppContainer><CustomerForm /></AppContainer>);
  expect(screen.getByLabelText("Nombre del comprador")).toHaveValue("Cliente");
  expect(screen.queryByText("Panel privado")).not.toBeInTheDocument();
  expect(screen.queryByText("Banner Flow")).not.toBeInTheDocument();

  mockAuth = { user: { id: "user-b" }, company: { id: "company-a" } };
  view.rerender(<AppContainer><CustomerForm /></AppContainer>);
  expect(screen.getByLabelText("Nombre del comprador")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Nombre del comprador"), { target: { value: "Otro cliente" } });
  mockAuth = null;
  view.rerender(<AppContainer><CustomerForm /></AppContainer>);
  expect(screen.getByLabelText("Nombre del comprador")).toHaveValue("");
});

test.each(["/live", `${publicCatalog}/payments`, "/live/not-a-uuid"])("private chrome stays on %s", (pathname) => {
  mockPathname = pathname;
  render(<AppContainer><p>Consola</p></AppContainer>);
  expect(screen.getByText("Panel privado")).toBeInTheDocument();
  expect(screen.getByText("Banner Flow")).toBeInTheDocument();
});
