import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { usePartnerAttributions } from "@/features/partners/hooks/use-partner-attributions";
import { toPartnerAttribution } from "@/features/partners/mappers/to-partner-attribution";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { buildAttributionDto } from "@/features/partners/test-utils/partner-attribution.fixture";
import { partnerAttributionsClient } from "@/features/partners/api/partner-attributions.api";
import { getPartnerAttributions } from "@/features/partners/services/get-partner-attributions";
import { LinkAttributionsSection } from "../link-attributions-section";

jest.mock("@/features/partners/context/current-partner.context", () => ({ useCurrentPartner: jest.fn() }));
jest.mock("@/features/partners/hooks/use-partner-attributions", () => ({ usePartnerAttributions: jest.fn() }));
jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.review.invalid/v1/partners" } }));

type AttributionQuery = ReturnType<typeof usePartnerAttributions>;
const attribution = toPartnerAttribution(buildAttributionDto());
function setupQuery(overrides: Partial<AttributionQuery> = {}) {
  const query = {
    data: undefined, isLoading: false, isError: false, error: null,
    isFetchNextPageError: false, hasNextPage: false, isFetchingNextPage: false,
    refetch: jest.fn(), fetchNextPage: jest.fn(), ...overrides,
  } as unknown as AttributionQuery;
  jest.mocked(usePartnerAttributions).mockReturnValue(query);
  return query;
}
function pages(...items: typeof attribution[]) {
  return { pages: [{ items, nextCursor: null }], pageParams: [null] };
}

beforeEach(() => {
  jest.mocked(usePartnerAttributions).mockReset();
  jest.mocked(useCurrentPartner).mockReturnValue({
    id: "11111111-1111-4111-8111-111111111111", status: "active", displayName: "Fixture Partner",
    country: "PE", currency: "PEN", referralLink: null, referralCode: null, permissions: ["REFERRALS_READ"],
  });
});

it("shows an independent loading state", () => {
  setupQuery({ isLoading: true });
  render(<LinkAttributionsSection />);
  expect(screen.getByRole("status")).toHaveTextContent(/cargando atribuciones por link/i);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("shows the real empty state and explains that attribution is not payment or commission", () => {
  setupQuery({ data: pages() });
  render(<LinkAttributionsSection />);
  expect(screen.getByText(/todavía no hay empresas atribuidas/i)).toBeInTheDocument();
  expect(screen.getByText(/no acredita pagos ni comisiones/i)).toBeInTheDocument();
});

it("shows only company identifiers, LINK and dates/evidence without business PII or invented financial fields", () => {
  setupQuery({ data: pages(attribution) });
  const { container } = render(<LinkAttributionsSection />);
  expect(screen.getByRole("table", { name: "Atribuciones LINK" })).toBeInTheDocument();
  expect(screen.getByText(attribution.companyId)).toBeInTheDocument();
  expect(screen.getByText("LINK")).toBeInTheDocument();
  expect(screen.getByText("Confirmada")).toBeInTheDocument();
  expect(screen.getByText("Primera captura válida")).toBeInTheDocument();
  expect(container.querySelector(`time[datetime="${attribution.confirmedAt}"]`)).toHaveTextContent("UTC");
  expect(container.querySelector(`time[datetime="${attribution.companyCreatedAt}"]`)).toBeInTheDocument();
  expect(screen.queryByText(buildAttributionDto().claimId)).not.toBeInTheDocument();
  expect(container.textContent).not.toMatch(/@|S\/|Plan|negocio demo/i);
});

it("renders the public v2 HTTP response through the real parser, service and mapper", async () => {
  const dto = buildAttributionDto({ resolutionVersion: 2 });
  const originalAdapter = partnerAttributionsClient.defaults.adapter;
  let requestUrl: string | undefined;
  let requestBearer: unknown;
  try {
    // Transport only is replaced: the existing response schema, service,
    // mapper and actual component execute. No network or real identity is used.
    partnerAttributionsClient.defaults.adapter = async (config) => {
      requestUrl = config.url;
      requestBearer = config.headers.Authorization;
      return {
        data: { items: [dto], nextCursor: null }, status: 200,
        statusText: "OK", headers: {}, config,
      };
    };
    const response = await getPartnerAttributions(null, "fixture-session-v2");
    expect(requestUrl).toBe("https://partners.review.invalid/v1/partners/me/attributions");
    expect(requestBearer).toBe("Bearer fixture-session-v2");
    expect(response.items[0].resolutionVersion).toBe(2);
    setupQuery({ data: pages(...response.items) });
    const { container } = render(<LinkAttributionsSection />);
    expect(screen.getByText(dto.companyId)).toBeInTheDocument();
    expect(screen.getByText("LINK")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(container.querySelector(`time[datetime="${dto.companyCreatedAt}"]`)).toBeInTheDocument();
    expect(container.querySelector(`time[datetime="${dto.confirmedAt}"]`)).toHaveTextContent("UTC");
    expect(screen.queryByText(dto.claimId)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/@|S\/|partnerAuth|ms-auth|Plan|negocio demo/i);
    expect(screen.getByText(/no acredita pagos ni comisiones/i)).toBeInTheDocument();
  } finally {
    partnerAttributionsClient.defaults.adapter = originalAdapter;
  }
});

it.each([
  [401, undefined, /sesión expiró/i],
  [403, undefined, /no tenés permiso/i],
  [503, "ATTRIBUTIONS_UNAVAILABLE", /atribuciones por link no están disponibles actualmente/i],
])("shows a safe HTTP %s error and lets the user retry", async (status, code, message) => {
  const query = setupQuery({ isError: true, error: buildAxiosError(status, { code }) });
  render(<LinkAttributionsSection />);
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  await userEvent.setup().click(screen.getByRole("button", { name: /reintentar/i }));
  expect(query.refetch).toHaveBeenCalledTimes(1);
});

it("requests more attributions and disables the cursor action while it is pending", async () => {
  const query = setupQuery({ data: pages(attribution), hasNextPage: true });
  const { rerender } = render(<LinkAttributionsSection />);
  await userEvent.setup().click(screen.getByRole("button", { name: /cargar más atribuciones/i }));
  expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  setupQuery({ data: pages(attribution), hasNextPage: true, isFetchingNextPage: true });
  rerender(<LinkAttributionsSection />);
  expect(screen.getByRole("button", { name: /cargando atribuciones/i })).toBeDisabled();
});

it("retains loaded evidence and reports a next-page error", () => {
  setupQuery({ data: pages(attribution), isError: true, isFetchNextPageError: true, error: buildAxiosError(503), hasNextPage: true });
  render(<LinkAttributionsSection />);
  expect(screen.getByText(attribution.companyId)).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/servicio de partners no está disponible/i);
  expect(screen.getByRole("button", { name: /cargar más atribuciones/i })).toBeInTheDocument();
});

it("does not query or expose evidence when REFERRALS_READ is absent", () => {
  const partner = jest.mocked(useCurrentPartner)();
  jest.mocked(useCurrentPartner).mockReturnValue({ ...partner, permissions: [] });
  setupQuery({ data: pages(attribution) });
  render(<LinkAttributionsSection />);
  expect(usePartnerAttributions).toHaveBeenCalledWith(false);
  expect(screen.getByText(/no tenés permiso para consultar atribuciones/i)).toBeInTheDocument();
  expect(screen.queryByText(attribution.companyId)).not.toBeInTheDocument();
});
