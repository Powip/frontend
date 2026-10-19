import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AppContainer from "../AppContainer";

let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "u1" }, company: { id: "c1" } } }),
}));
jest.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => <nav /> }));
jest.mock("@/components/header/BusinessScopeBar", () => ({ BusinessScopeBar: () => null }));
jest.mock("@/components/auth/AuthGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/subscription/FlowMigrationBanner", () => ({
  __esModule: true,
  default: () => <p>banner de migración</p>,
}));

it.each(["/dashboard", "/ventas"])("el banner va arriba de las pantallas con menú: %s", (path) => {
  mockPathname = path;
  render(<AppContainer><p>contenido</p></AppContainer>);

  expect(screen.getByText("banner de migración")).toBeInTheDocument();
});

it.each(["/pasate-a-flow", "/cuenta-suspendida", "/onboarding", "/login"])("no va en pantallas sin menú: %s", (path) => {
  mockPathname = path;
  render(<AppContainer><p>contenido</p></AppContainer>);

  expect(screen.queryByText("banner de migración")).not.toBeInTheDocument();
});
