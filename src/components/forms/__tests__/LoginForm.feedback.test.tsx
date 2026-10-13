import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getPartnerLoginStatus } from "@/features/partners/services/get-partner-login-status";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { loginErrorMessage } from "@/lib/authErrors";
import LoginForm from "../LoginForm";

const mockPush = jest.fn();
const mockLogin = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, post: jest.fn() },
  };
});
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.fixture.invalid" } }));
jest.mock("@/features/partners/services/get-partner-login-status", () => ({
  getPartnerLoginStatus: jest.fn(),
}));
jest.mock("../../modals/forgotPasswortModal", () => ({
  __esModule: true,
  default: () => null,
}));

const mockPost = jest.mocked(axios.post);
const EMAIL = "feedback@fixture.invalid";
const PASSWORD = "synthetic123";

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockReset();
  mockLogin.mockReset();
  jest.mocked(useAuth).mockReturnValue({
    auth: null,
    login: mockLogin,
  } as unknown as ReturnType<typeof useAuth>);
});

function inputs() {
  return {
    email: screen.getByLabelText("Correo electrónico"),
    password: screen.getByLabelText("Contraseña"),
  };
}

function fillCredentials() {
  const fields = inputs();
  fireEvent.change(fields.email, { target: { value: EMAIL } });
  fireEvent.change(fields.password, { target: { value: PASSWORD } });
  return fields;
}

function expectSingleToast(title: string, description: string) {
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith(
    title,
    expect.objectContaining({
      id: "auth-feedback",
      description,
      duration: 6000,
      closeButton: true,
    }),
  );
}

it("en submit vacío indica ambos campos, enfoca el primero y emite un solo toast sin request", async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
  const fields = inputs();

  expect(fields.email).toHaveFocus();
  expect(fields.email).toHaveAttribute("aria-invalid", "true");
  expect(fields.email).toHaveAccessibleDescription("Ingresa tu correo electrónico.");
  expect(fields.password).toHaveAttribute("aria-invalid", "true");
  expect(fields.password).toHaveAccessibleDescription("Ingresa tu contraseña.");
  expectSingleToast("Revisa tus datos", "Ingresa tu correo electrónico.");
  expect(mockPost).not.toHaveBeenCalled();
  expect(mockLogin).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it("conserva la validación del correo mientras es inválido y la limpia al corregirlo", async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  const fields = inputs();
  fireEvent.change(fields.email, { target: { value: "correo-invalido" } });
  fireEvent.change(fields.password, { target: { value: PASSWORD } });
  await user.click(screen.getByRole("button", { name: "Ingresar" }));

  expect(fields.email).toHaveFocus();
  expect(fields.email).toHaveAccessibleDescription("Usa un correo válido, como tu@negocio.com.");
  fireEvent.change(fields.email, { target: { value: "todavia-invalido" } });
  expect(fields.email).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Usa un correo válido, como tu@negocio.com.")).toBeInTheDocument();
  fireEvent.change(fields.email, { target: { value: EMAIL } });
  expect(fields.email).toHaveAttribute("aria-invalid", "false");
  expect(fields.email).not.toHaveAttribute("aria-describedby");
  expect(screen.queryByText("Usa un correo válido, como tu@negocio.com.")).not.toBeInTheDocument();
  expectSingleToast("Revisa tus datos", "Usa un correo válido, como tu@negocio.com.");
  expect(mockPost).not.toHaveBeenCalled();
});

it.each([
  ["credenciales HTTP 401", buildAxiosError(401, { message: "Usuario no encontrado" })],
  ["límite HTTP 429", buildAxiosError(429)],
  ["conexión", buildAxiosError()],
])(
  "muestra %s en aviso persistente y un solo toast, conservando los datos sin navegar",
  async (_, error) => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce(error);
    render(<LoginForm />);
    const fields = fillCredentials();
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    const notice = await screen.findByRole("alert");
    const message = loginErrorMessage(error);

    expect(within(notice).getByText("No pudimos iniciar sesión")).toBeInTheDocument();
    expect(within(notice).getByText(message)).toBeInTheDocument();
    expectSingleToast("No pudimos iniciar sesión", message);
    expect(fields.email).toHaveValue(EMAIL);
    expect(fields.password).toHaveValue(PASSWORD);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      { email: EMAIL, password: PASSWORD },
      { withCredentials: true },
    );
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(getPartnerLoginStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    await user.click(fields.password);
    await user.tab();
    expect(within(screen.getByRole("alert")).getByText(message)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);

    fireEvent.change(fields.password, { target: { value: `${PASSWORD}4` } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

it("muestra sesión no cargada como aviso y toast sin navegar ni llamar el callback", async () => {
  const user = userEvent.setup();
  const onAuthenticated = jest.fn();
  mockPost.mockResolvedValueOnce({ data: { accessToken: "synthetic-token" } });
  mockLogin.mockResolvedValueOnce(null);
  render(<LoginForm onAuthenticated={onAuthenticated} />);
  fillCredentials();
  await user.click(screen.getByRole("button", { name: "Ingresar" }));

  const notice = await screen.findByRole("alert");
  const message = "No pudimos cargar tu sesión. Intenta ingresar nuevamente.";
  expect(within(notice).getByText(message)).toBeInTheDocument();
  expectSingleToast("No pudimos iniciar sesión", message);
  expect(mockLogin).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  expect(onAuthenticated).not.toHaveBeenCalled();
  expect(inputs().password).toHaveValue(PASSWORD);
});

it("evita requests y toasts duplicados al recibir dos submits mientras espera respuesta", async () => {
  let rejectRequest: ((reason: unknown) => void) | undefined;
  mockPost.mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectRequest = reject;
    }),
  );
  render(<LoginForm />);
  const fields = fillCredentials();
  const form = fields.email.closest("form");
  expect(form).not.toBeNull();
  if (!form) throw new Error("El formulario debe existir.");
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });

  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(form).toHaveAttribute("aria-busy", "true");
  expect(fields.email).toBeDisabled();
  expect(fields.password).toBeDisabled();
  expect(screen.getByRole("button", { name: "Iniciando sesión..." })).toBeDisabled();
  expect(toast.error).not.toHaveBeenCalled();
  const error = buildAxiosError(401);
  await act(async () => rejectRequest?.(error));
  await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
  expectSingleToast("No pudimos iniciar sesión", loginErrorMessage(error));
  expect(mockPost).toHaveBeenCalledTimes(1);
});
