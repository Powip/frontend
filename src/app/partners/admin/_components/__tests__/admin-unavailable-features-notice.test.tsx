import { render, screen } from "@testing-library/react";
import { AdminUnavailableFeaturesNotice } from "../admin-simulated-data-notice";

let mockPathname = "";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

it.each([
  "/partners/admin",
  "/partners/admin/partners",
  "/partners/admin/partners/fixture-id",
  "/partners/admin/solicitudes",
])("does not label implemented read sections as wholly unavailable: %s", (path) => {
  mockPathname = path;
  render(<AdminUnavailableFeaturesNotice />);
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
});

it.each([
  "/partners/admin/liquidaciones",
  "/partners/admin/reglas",
  "/partners/admin/cola",
  "/partners/admin/casuistica",
  "/partners/admin/partners-fake",
])("keeps genuinely unimplemented sections explicit: %s", (path) => {
  mockPathname = path;
  render(<AdminUnavailableFeaturesNotice />);
  expect(screen.getByRole("note")).toHaveTextContent("funciones pendientes");
  expect(screen.getByRole("note")).toHaveTextContent("cálculos financieros siguen pendientes");
});
