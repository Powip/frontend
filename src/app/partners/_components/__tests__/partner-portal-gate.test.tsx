import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { usePartnerIdentity } from "@/features/partners/hooks/use-partner-identity";
import type { PartnerIdentity } from "@/features/partners/models/partner-identity";
import type { PartnerPermission } from "@/features/partners/models/partner-permission.enum";
import type { PartnerProfile } from "@/features/partners/models/partner-profile";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { PartnerPortalGate } from "../partner-portal-gate";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/features/partners/hooks/use-partner-identity", () => ({
  usePartnerIdentity: jest.fn(),
}));

const mockUsePathname = jest.mocked(usePathname);
const mockUsePartnerIdentity = jest.mocked(usePartnerIdentity);

type IdentityQuery = ReturnType<typeof usePartnerIdentity>;

function buildProfile(overrides: Partial<PartnerProfile> = {}): PartnerProfile {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status: "active",
    displayName: "Partner Demo",
    country: "PE",
    currency: "PEN",
    referralLink: null,
    referralCode: "PARTNERDEMO",
    permissions: ["REFERRALS_READ", "REFERRALS_CREATE", "COMMISSIONS_READ", "PAYOUTS_READ"],
    ...overrides,
  };
}

function setupIdentity(state: { data?: PartnerIdentity; error?: Error | null }) {
  const refetch = jest.fn();
  mockUsePartnerIdentity.mockReturnValue({
    data: state.data,
    error: state.error ?? null,
    refetch,
  } as unknown as IdentityQuery);
  return refetch;
}

function PortalContent() {
  const partner = useCurrentPartner();
  return <p>Contenido del portal de {partner.displayName}</p>;
}

function renderGate(pathname = "/partners") {
  mockUsePathname.mockReturnValue(pathname);
  return render(
    <PartnerPortalGate>
      <PortalContent />
    </PartnerPortalGate>,
  );
}

function activeWith(permissions: PartnerPermission[]): PartnerIdentity {
  return { kind: "partner", profile: buildProfile({ permissions }) };
}

describe("PartnerPortalGate", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUsePartnerIdentity.mockReset();
  });

  it("muestra el estado de carga mientras verifica la cuenta y no renderiza el portal", () => {
    setupIdentity({});

    renderGate();

    expect(screen.getByText(/verificando tu cuenta de partner/i)).toBeInTheDocument();
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("muestra ausencia de perfil cuando la cuenta no es partner", () => {
    setupIdentity({ data: { kind: "not_partner" } });

    renderGate();

    expect(screen.getByText(/esta cuenta no tiene un perfil de partner/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir al dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
  });

  it("bloquea el portal cuando /me devuelve un perfil suspendido", () => {
    setupIdentity({ data: { kind: "partner", profile: buildProfile({ status: "suspended" }) } });

    renderGate();

    expect(screen.getByText(/tu cuenta de partner está suspendida/i)).toBeInTheDocument();
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("bloquea el portal cuando /me responde 403 PARTNER_NOT_ACTIVE suspendido", () => {
    setupIdentity({ data: { kind: "not_active", status: "suspended" } });

    renderGate();

    expect(screen.getByText(/tu cuenta de partner está suspendida/i)).toBeInTheDocument();
  });

  it.each([
    ["pending", /tu solicitud de partner está en revisión/i],
    ["rejected", /tu solicitud de partner no fue aprobada/i],
    ["unknown", /tu cuenta de partner no está activa/i],
  ] as const)("muestra el aviso de cuenta no activa (%s)", (status, text) => {
    setupIdentity({ data: { kind: "not_active", status } });

    renderGate();

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
  });

  it("ante un error de red muestra el error con reintento y sin datos de reemplazo", async () => {
    const refetch = setupIdentity({ error: buildAxiosError() });
    const user = userEvent.setup();

    renderGate();
    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /no pudimos verificar tu cuenta de partner/i,
    );
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("muestra el código de referencia cuando el backend devuelve correlationId", () => {
    setupIdentity({
      error: buildAxiosError(503, { code: "UNAVAILABLE", correlationId: "corr-123" }),
    });

    renderGate();

    expect(screen.getByText(/código de referencia: corr-123/i)).toBeInTheDocument();
  });

  it("ante un 401 indica que no pudo validar la sesión de partner", () => {
    setupIdentity({ error: buildAxiosError(401) });

    renderGate();

    expect(
      screen.getByText(/no pudimos validar tu sesión para el programa de partners/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
  });

  it("con perfil activo renderiza el portal y expone el partner actual", () => {
    setupIdentity({ data: activeWith(["REFERRALS_READ"]) });

    renderGate();

    expect(screen.getByText("Contenido del portal de Partner Demo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /secciones de partners/i })).toBeInTheDocument();
  });

  it("oculta las pestañas cuyo permiso no tiene el partner", () => {
    setupIdentity({ data: activeWith(["REFERRALS_READ"]) });

    renderGate();

    expect(screen.getByRole("link", { name: "Mis Referidos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comisiones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pagos" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumen" })).toBeInTheDocument();
  });

  it.each([
    ["/partners/referidos", "REFERRALS_READ"],
    ["/partners/comisiones", "COMMISSIONS_READ"],
    ["/partners/pagos", "PAYOUTS_READ"],
  ] as const)("sin %s el contenido de %s queda bloqueado", (pathname, permission) => {
    const others = (
      ["REFERRALS_READ", "COMMISSIONS_READ", "PAYOUTS_READ"] as PartnerPermission[]
    ).filter((p) => p !== permission);
    setupIdentity({ data: activeWith(others) });

    renderGate(pathname);

    expect(screen.getByText(/no tenés acceso a esta sección/i)).toBeInTheDocument();
    expect(screen.queryByText(/contenido del portal/i)).not.toBeInTheDocument();
  });

  it("con el permiso requerido renderiza la sección", () => {
    setupIdentity({ data: activeWith(["COMMISSIONS_READ"]) });

    renderGate("/partners/comisiones");

    expect(screen.getByText(/contenido del portal/i)).toBeInTheDocument();
  });

  it("en /partners/admin no consulta /me ni aplica el acceso de partner", () => {
    mockUsePathname.mockReturnValue("/partners/admin/partners");

    render(
      <PartnerPortalGate>
        <p>Panel admin</p>
      </PartnerPortalGate>,
    );

    expect(screen.getByText("Panel admin")).toBeInTheDocument();
    expect(mockUsePartnerIdentity).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
