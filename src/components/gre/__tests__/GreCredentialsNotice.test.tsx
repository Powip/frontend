import { act, render, screen } from "@testing-library/react";
import GreCredentialsNotice, {
  GRE_NOTICE_SESSION_KEY,
  missingGreCredentials,
} from "../GreCredentialsNotice";

let mockSettings: unknown;
jest.mock("@/features/sunat/despatch-advice/hooks/use-despatch-advices", () => ({
  useGreSettings: () => ({ data: mockSettings }),
}));
jest.mock("@/app/configuracion/_components/HelpSection", () => ({ SUPPORT_WHATSAPP_URL: "https://wa.me/test" }));

const profile = (configured: boolean, isActive = true) => ({
  sunatProfileId: "p1", ruc: "20", razonSocial: "X", isDefault: true, isActive, configured,
  clientId: null, series: null, nextCorrelative: null, updatedAt: null,
});
const settings = (...profiles: ReturnType<typeof profile>[]) => ({
  sunatConnection: "SUNAT", enabledForCompany: true, profiles,
});

beforeEach(() => {
  jest.useFakeTimers();
  window.sessionStorage.clear();
});
afterEach(() => jest.useRealTimers());

test("missingGreCredentials", () => {
  expect(missingGreCredentials(undefined)).toBe(false);
  expect(missingGreCredentials(settings() as never)).toBe(false);
  expect(missingGreCredentials(settings(profile(true)) as never)).toBe(false);
  expect(missingGreCredentials(settings(profile(false, false)) as never)).toBe(false);
  expect(missingGreCredentials(settings(profile(false)) as never)).toBe(true);
});

test("sin credenciales: pop-up una vez por sesión y recuadro cada 60 s que se va a los 4 s", () => {
  mockSettings = settings(profile(false));
  render(<GreCredentialsNotice />);
  expect(screen.getByRole("dialog")).toHaveTextContent("grupal de soporte");
  expect(window.sessionStorage.getItem(GRE_NOTICE_SESSION_KEY)).toBe("1");
  expect(screen.queryByTestId("gre-credentials-box")).toBeNull();
  act(() => { jest.advanceTimersByTime(60_000); });
  expect(screen.getByTestId("gre-credentials-box")).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(3_999); });
  expect(screen.getByTestId("gre-credentials-box")).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(1); });
  expect(screen.queryByTestId("gre-credentials-box")).toBeNull();
});

test("el pop-up no se repite en la misma sesión", () => {
  mockSettings = settings(profile(false));
  window.sessionStorage.setItem(GRE_NOTICE_SESSION_KEY, "1");
  render(<GreCredentialsNotice />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("con credenciales no muestra nada", () => {
  mockSettings = settings(profile(true));
  const { container } = render(<GreCredentialsNotice />);
  act(() => { jest.advanceTimersByTime(61_000); });
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole("dialog")).toBeNull();
});
