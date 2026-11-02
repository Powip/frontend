import { render, screen } from "@testing-library/react";
import LiquidacionesPage from "../page";
let finance = true;
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "company" }, user: { id: "finance-user", role: "CONTADOR" } },
    hasPermission: (permission: string) => finance && permission === "VIEW_FINANCES",
  }),
}));
jest.mock("@/contexts/OperationsRoleContext", () => ({
  useOperationsRole: () => ({ can: () => false }),
  OPS_PERMISSIONS: { MANAGE_LIQUIDACIONES: "OPS_MANAGE_LIQUIDACIONES" },
}));
jest.mock("../_components/CourierSettlementWorkspace", () => ({
  CourierSettlementWorkspace: ({ companyId }: { companyId: string }) => (
    <div>Liquidaciones de {companyId}</div>
  ),
}));
it("allows a finance user without an operations admin role to reach server capabilities", () => {
  finance = true;
  render(<LiquidacionesPage />);
  expect(screen.getByText("Liquidaciones de company")).toBeInTheDocument();
});
it("does not request financial data without finance or operations access", () => {
  finance = false;
  render(<LiquidacionesPage />);
  expect(screen.getByText("No tienes acceso a Liquidaciones")).toBeInTheDocument();
});
