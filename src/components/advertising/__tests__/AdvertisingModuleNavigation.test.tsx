import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getRoutePermissions } from "@/config/permissions.config";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdvertisingModulePage } from "../AdvertisingModulePage";
import { AdvertisingModuleShell } from "../AdvertisingModuleShell";

const replace = jest.fn();
let mockPathname = "/publicidad";
let mockQueryString = "";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(mockQueryString),
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => (props: Record<string, unknown>) => (
    <output aria-label="Panel de publicidad">{JSON.stringify(props)}</output>
  ),
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
  mockQueryString = "";
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
  expect(screen.getByRole("heading", { name: "Publicidad" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Resumen" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Conexiones" })).toHaveAttribute(
    "href",
    "/publicidad/conexiones",
  );
  expect(screen.getByText("2026-09-11 / 2026-10-10")).toBeVisible();
  expect(screen.getByRole("group", { name: "Periodo seleccionado" })).toHaveTextContent(
    "11 sep–10 oct",
  );
  expect(screen.queryByText("Consulta la publicidad de tu empresa.")).not.toBeInTheDocument();
  expect(screen.queryByText("ADMINISTRACIÓN")).not.toBeInTheDocument();
  await userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .click(screen.getByRole("button", { name: "Ayer" }));
  expect(screen.getByText("2026-10-09 / 2026-10-09")).toBeVisible();
  expect(screen.getByRole("group", { name: "Periodo seleccionado" })).toHaveTextContent("9 oct");
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
  expect(screen.queryByRole("group", { name: "Periodo seleccionado" })).not.toBeInTheDocument();
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

it("preserves the linked ad and account while applying the URL period before mounting its reader", () => {
  mockPathname = "/publicidad/anuncios";
  mockQueryString = "from=2026-10-01&to=2026-10-02&accountId=account&adId=456";
  const view = render(
    <AdvertisingModuleShell>
      <AdvertisingModulePage view="ads" />
    </AdvertisingModuleShell>,
  );
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      actorId: "actor",
      companyId: "company",
      from: "2026-10-01",
      to: "2026-10-02",
      initialAccountId: "account",
      initialAdId: "456",
      level: "ad",
    }),
  );
  expect(screen.getByRole("group", { name: "Periodo seleccionado" })).toHaveTextContent("1–2 oct");
  mockQueryString = "from=2026-10-03&to=2026-10-04&accountId=account&adId=789";
  view.rerender(
    <AdvertisingModuleShell>
      <AdvertisingModulePage view="ads" />
    </AdvertisingModuleShell>,
  );
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      from: "2026-10-03",
      to: "2026-10-04",
      initialAccountId: "account",
      initialAdId: "789",
    }),
  );
});

it("keeps both years visible when a linked period crosses the year boundary", () => {
  mockPathname = "/publicidad/anuncios";
  mockQueryString = "from=2025-12-31&to=2026-01-01&accountId=account&adId=456";
  render(
    <AdvertisingModuleShell>
      <AdvertisingModulePage view="ads" />
    </AdvertisingModuleShell>,
  );
  expect(screen.getByRole("group", { name: "Periodo seleccionado" })).toHaveTextContent(
    "31 dic 2025–1 ene 2026",
  );
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      from: "2025-12-31",
      to: "2026-01-01",
      initialAccountId: "account",
      initialAdId: "456",
    }),
  );
});

it("opens Meta results first and mounts existing Powip results only when that tab is selected", async () => {
  mockPathname = "/publicidad/resultados";
  mockQueryString = "from=2026-10-01&to=2026-10-02&accountId=account&resultType=webPurchases";
  const view = render(
    <AdvertisingModuleShell>
      <AdvertisingModulePage view="results" />
    </AdvertisingModuleShell>,
  );
  expect(screen.getByRole("link", { name: "Resultados" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByLabelText("Panel de publicidad")).toHaveLength(1);
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      actorId: "actor",
      companyId: "company",
      from: "2026-10-01",
      to: "2026-10-02",
      initialAccountId: "account",
      initialResultType: "webPurchases",
      level: "ad",
      presentation: "results",
    }),
  );
  await userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .click(screen.getByRole("tab", { name: "Pedidos Powip" }));
  expect(screen.getAllByLabelText("Panel de publicidad")).toHaveLength(1);
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      actorId: "actor",
      companyId: "company",
      from: "2026-10-01",
      to: "2026-10-02",
      view: "results",
    }),
  );
  mockQueryString = "from=2026-10-03&to=2026-10-04";
  view.rerender(
    <AdvertisingModuleShell>
      <AdvertisingModulePage view="results" />
    </AdvertisingModuleShell>,
  );
  expect(screen.getByRole("tab", { name: "Meta" })).toHaveAttribute("aria-selected", "true");
  expect(JSON.parse(screen.getByLabelText("Panel de publicidad").textContent ?? "{}")).toEqual(
    expect.objectContaining({
      from: "2026-10-03",
      to: "2026-10-04",
      initialResultType: "messages",
      level: "ad",
    }),
  );
});
