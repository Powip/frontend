import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getRoutePermissions } from "@/config/permissions.config";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdvertisingModuleShell } from "../AdvertisingModuleShell";

const replace = jest.fn();
let mockPathname = "/publicidad";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/header/Header", () => ({
  __esModule: true,
  default: () => <div>Cabecera Powip</div>,
}));
jest.mock("@/components/dashboard/PeriodSelector", () => ({
  PeriodSelector: () => <div>Selector de fechas</div>,
}));

function PeriodEvidence() {
  const { fromDate, toDate } = useAdminPeriod();
  return (
    <p>
      {fromDate} / {toDate}
    </p>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-10T12:00:00Z"));
  mockPathname = "/publicidad";
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { id: "actor" }, company: { id: "company" } },
    loading: false,
    hasPermission: (permission: string) => permission === "VIEW_FINANCES",
  } as unknown as ReturnType<typeof useAuth>);
});
afterEach(() => jest.useRealTimers());

it("opens Publicidad with its own navigation and a shared 30-day period", async () => {
  render(
    <AdvertisingModuleShell>
      <PeriodEvidence />
    </AdvertisingModuleShell>,
  );
  expect(screen.getByRole("heading", { name: "Publicidad" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Resumen" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Conexiones" })).toHaveAttribute(
    "href",
    "/publicidad/conexiones",
  );
  expect(screen.getByText("2026-09-11 / 2026-10-10")).toBeVisible();
  expect(screen.queryByText("ADMINISTRACIÓN")).not.toBeInTheDocument();
  await userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .click(screen.getByRole("button", { name: "Ayer" }));
  expect(screen.getByText("2026-10-09 / 2026-10-09")).toBeVisible();
});

it("keeps Conexiones in the same module and hides period controls there", () => {
  mockPathname = "/publicidad/conexiones";
  render(
    <AdvertisingModuleShell>
      <p>Cuentas de la empresa</p>
    </AdvertisingModuleShell>,
  );
  expect(screen.getByRole("link", { name: "Conexiones" })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("button", { name: "30 días" })).not.toBeInTheDocument();
  expect(screen.queryByText("Selector de fechas")).not.toBeInTheDocument();
});

it("does not mount financial content without VIEW_FINANCES", () => {
  jest.mocked(useAuth).mockReturnValue({
    auth: { user: { role: "ADMIN" } },
    loading: false,
    hasPermission: () => false,
  } as unknown as ReturnType<typeof useAuth>);
  render(
    <AdvertisingModuleShell>
      <p>Importe privado</p>
    </AdvertisingModuleShell>,
  );
  expect(screen.queryByText("Importe privado")).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith("/dashboard");
  expect(getRoutePermissions("/publicidad/conexiones")).toEqual(["VIEW_FINANCES"]);
});
