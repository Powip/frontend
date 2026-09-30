import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { useReferrals } from "@/features/partners/hooks/use-referrals";
import type { PartnerPermission } from "@/features/partners/models/partner-permission.enum";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";
import { ReferidosPageContent } from "../referidos-page-content";

jest.mock("@/features/partners/hooks/use-referrals", () => ({
  useReferrals: jest.fn(),
}));

jest.mock("@/features/partners/context/current-partner.context", () => ({
  useCurrentPartner: jest.fn(),
}));

jest.mock("../register-referral-dialog", () => ({
  RegisterReferralDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Formulario de alta</div> : null,
}));

jest.mock("../referral-detail-drawer", () => ({
  ReferralDetailDrawer: () => null,
}));

const mockUseReferrals = jest.mocked(useReferrals);
const mockUseCurrentPartner = jest.mocked(useCurrentPartner);

function setupPartner(permissions: PartnerPermission[]) {
  mockUseCurrentPartner.mockReturnValue({
    id: "22222222-2222-4222-8222-222222222222",
    status: "active",
    displayName: "Partner Demo",
    country: "PE",
    currency: "PEN",
    referralLink: null,
    referralCode: null,
    permissions,
  });
}

type ReferralsQuery = ReturnType<typeof useReferrals>;

function makeReferral(id: string, overrides: Partial<PartnerReferral> = {}): PartnerReferral {
  return {
    id,
    businessName: `Negocio ${id}`,
    origin: "link",
    status: "cuenta_creada",
    registeredAt: "2026-09-24T15:00:00Z",
    planName: null,
    firstMonthCommission: null,
    recurringCommission: null,
    ...overrides,
  };
}

function setupQuery(overrides: Partial<ReferralsQuery>) {
  const query = {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    ...overrides,
  } as unknown as ReferralsQuery;
  mockUseReferrals.mockReturnValue(query);
  return query;
}

function pagesOf(...pages: PartnerReferral[][]) {
  return {
    pages: pages.map((items, index) => ({
      items,
      nextCursor: index < pages.length - 1 ? `cursor-${index + 2}` : null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index + 1}`)),
  } as unknown as ReferralsQuery["data"];
}

describe("ReferidosPageContent", () => {
  beforeEach(() => {
    mockUseReferrals.mockReset();
    setupPartner(["REFERRALS_READ", "REFERRALS_CREATE"]);
  });

  it("con REFERRALS_CREATE ofrece registrar un referido y abre el formulario", async () => {
    setupQuery({ data: pagesOf([makeReferral("1")]) });
    const user = userEvent.setup();

    render(<ReferidosPageContent />);
    await user.click(screen.getByRole("button", { name: /\+ registrar referido/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Formulario de alta");
  });

  it("sin REFERRALS_CREATE no ofrece registrar referidos pero sigue listándolos", () => {
    setupPartner(["REFERRALS_READ"]);
    setupQuery({ data: pagesOf([makeReferral("1")]) });

    render(<ReferidosPageContent />);

    expect(screen.getByText("Negocio 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registrar referido/i })).not.toBeInTheDocument();
  });

  it("sin REFERRALS_CREATE el estado vacío no ofrece la acción de alta", () => {
    setupPartner(["REFERRALS_READ"]);
    setupQuery({ data: pagesOf([]) });

    render(<ReferidosPageContent />);

    expect(screen.getByText(/todavía no tenés referidos/i)).toBeInTheDocument();
    expect(screen.getByText(/compartí tu link para empezar/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registrar referido/i })).not.toBeInTheDocument();
  });

  it("muestra skeletons mientras carga", () => {
    setupQuery({ isLoading: true });

    const { container } = render(<ReferidosPageContent />);

    expect(
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando el backend devuelve items []", () => {
    setupQuery({ data: pagesOf([]) });

    render(<ReferidosPageContent />);

    expect(screen.getByText(/todavía no tenés referidos/i)).toBeInTheDocument();
  });

  it("muestra el error con reintento cuando falla la primera carga", async () => {
    const query = setupQuery({ isError: true });
    const user = userEvent.setup();

    render(<ReferidosPageContent />);
    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(screen.getByText(/no pudimos cargar tus referidos/i)).toBeInTheDocument();
    expect(query.refetch).toHaveBeenCalled();
  });

  it("renderiza los referidos de todas las páginas cargadas", () => {
    setupQuery({ data: pagesOf([makeReferral("1")], [makeReferral("2")]) });

    render(<ReferidosPageContent />);

    expect(screen.getByText("Negocio 1")).toBeInTheDocument();
    expect(screen.getByText("Negocio 2")).toBeInTheDocument();
  });

  it('muestra "Cargar más" cuando hay nextCursor y pide la página siguiente', async () => {
    const query = setupQuery({ data: pagesOf([makeReferral("1")]), hasNextPage: true });
    const user = userEvent.setup();

    render(<ReferidosPageContent />);
    await user.click(screen.getByRole("button", { name: /cargar más/i }));

    expect(query.fetchNextPage).toHaveBeenCalled();
  });

  it('no muestra "Cargar más" cuando no hay más páginas', () => {
    setupQuery({ data: pagesOf([makeReferral("1")]), hasNextPage: false });

    render(<ReferidosPageContent />);

    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("si falla la página siguiente conserva la tabla y avisa del error", () => {
    setupQuery({
      data: pagesOf([makeReferral("1")]),
      isError: true,
      isFetchNextPageError: true,
      hasNextPage: true,
    });

    render(<ReferidosPageContent />);

    expect(screen.getByText("Negocio 1")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/no pudimos cargar más referidos/i);
    expect(screen.queryByText(/no pudimos cargar tus referidos/i)).not.toBeInTheDocument();
  });
});
