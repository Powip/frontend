import { render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import FlowMigrationBanner from "../FlowMigrationBanner";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

type Access = { state: "OK" | "AVISO" | "BLOQUEADO"; deadline: string | null; firstChargeDate: null; owner: boolean };

function renderWith({
  access,
  endDate = "2026-10-28",
  status = "ACTIVE",
  email = "dueno@test.pe",
  hasCompany = true,
}: { access: Access | null; endDate?: string | null; status?: string; email?: string; hasCompany?: boolean }) {
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "u1", email, companyId: hasCompany ? "c1" : null },
      company: hasCompany ? { id: "c1", name: "29 Superfoods" } : null,
      subscription: { id: "s1", status, plan: { id: "p1", name: "Basic" }, gateway: "MANUAL", endDate },
      access,
    },
  } as unknown as ReturnType<typeof useAuth>);
  return render(<FlowMigrationBanner />);
}

const aviso: Access = { state: "AVISO", deadline: "2026-10-23", firstChargeDate: null, owner: true };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-20T17:00:00Z")); // 12:00 en Lima
});

afterEach(() => {
  jest.useRealTimers();
});

it("al dueño con días pagados le avisa la fecha y que hoy no se le cobra", () => {
  renderWith({ access: aviso });

  expect(
    screen.getByText(
      "Registra tu tarjeta o Yape hasta el viernes 23/10 para seguir usando Powip. Hoy no te cobramos nada: el primer cobro es cuando vence lo que ya pagaste.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pasarme a Flow" })).toHaveAttribute("href", "/pasate-a-flow");
});

it("al dueño vencido solo le avisa la fecha", () => {
  renderWith({ access: aviso, endDate: "2026-10-18" });

  expect(screen.getByText("Registra tu tarjeta o Yape hasta el viernes 23/10 para seguir usando Powip.")).toBeInTheDocument();
  expect(screen.queryByText(/Hoy no te cobramos nada/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pasarme a Flow" })).toBeInTheDocument();
});

it("un checkout viejo sin pagar no cuenta como días pagados", () => {
  renderWith({ access: aviso, status: "PENDING_PAYMENT", endDate: "2026-12-01" });

  expect(screen.queryByText(/Hoy no te cobramos nada/)).not.toBeInTheDocument();
});

it.each([
  ["el personal", { access: { ...aviso, owner: false } }],
  ["una empresa al día", { access: { ...aviso, state: "OK" as const, deadline: null } }],
  ["una empresa bloqueada", { access: { ...aviso, state: "BLOQUEADO" as const } }],
  ["sin dato de acceso", { access: null }],
  ["un superadmin", { access: aviso, email: "octatoledo7@gmail.com" }],
  ["un usuario sin empresa (alta nueva en /sin-plan, partners)", { access: aviso, hasCompany: false }],
])("no se muestra para %s", (_label, props) => {
  const { container } = renderWith(props);

  expect(container).toBeEmptyDOMElement();
});
