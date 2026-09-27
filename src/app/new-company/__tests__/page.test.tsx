import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import NewCompanyPage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserCompany } from "@/services/companyService";

jest.mock("axios");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/companyService", () => ({ fetchUserCompany: jest.fn() }));

const mockUseAuth = jest.mocked(useAuth);
const mockedPost = axios.post as jest.Mock;
const mockedFetchCompany = jest.mocked(fetchUserCompany);

describe("NewCompanyPage (onboarding, FEAT-11)", () => {
  const updateCompany = jest.fn();
  const setSelectedStore = jest.fn();
  const refreshSession = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      auth: { accessToken: "jwt", user: { id: "u1", email: "a@t.pe" } },
      updateCompany,
      setSelectedStore,
      refreshSession,
    } as unknown as ReturnType<typeof useAuth>);
  });

  const fill = (id: string, value: string) =>
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });

  it("no avanza al paso 2 sin nombre de empresa", () => {
    render(<NewCompanyPage />);
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText("Este campo es obligatorio.")).toBeInTheDocument();
    expect(document.getElementById("billingAddress")).toBeNull();
  });

  it("crea la empresa del usuario logueado, renueva la sesión y va al dashboard", async () => {
    mockedPost.mockResolvedValue({ status: 201 });
    mockedFetchCompany.mockResolvedValue({ id: "c1", name: "Mi Empresa", stores: [{ id: "s1", name: "Principal" }] } as never);

    render(<NewCompanyPage />);
    fill("companyName", "Mi Empresa SAC");
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fill("billingAddress", "Av. Larco 123");
    fill("phone", "+51 987 654 321");
    fill("email", "empresa@test.pe");
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toMatch(/\/company$/);
    expect((body as FormData).get("user_id")).toBe("u1");
    expect((body as FormData).get("name")).toBe("Mi Empresa SAC");
    expect(config.headers.Authorization).toBe("Bearer jwt");
    expect(updateCompany).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
    expect(setSelectedStore).toHaveBeenCalledWith("s1");
    expect(refreshSession).toHaveBeenCalled();
  });

  it("si ms-company rechaza (sin suscripción pagada) muestra el motivo y no navega", async () => {
    const { toast } = jest.requireMock("sonner");
    mockedPost.mockRejectedValue({ response: { data: { message: "Debes tener una suscripción activa (plan pagado) para crear la empresa." } } });

    render(<NewCompanyPage />);
    fill("companyName", "Mi Empresa SAC");
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fill("billingAddress", "Av. Larco 123");
    fill("phone", "+51 987 654 321");
    fill("email", "empresa@test.pe");
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/suscripción activa/)));
    expect(push).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
