import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import CuentaSuspendidaPage from "../page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

const refreshSubscription = jest.fn().mockResolvedValue(undefined);
const logout = jest.fn().mockResolvedValue(undefined);

function renderWith(companyName: string | null) {
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "staff", email: "staff@test.pe" },
      company: companyName ? { id: "c1", name: companyName } : null,
      access: { state: "BLOQUEADO", deadline: "2026-10-23", firstChargeDate: null, owner: false },
    },
    refreshSubscription,
    logout,
  } as unknown as ReturnType<typeof useAuth>);
  render(<CuentaSuspendidaPage />);
}

beforeEach(() => {
  mockPush.mockReset();
  refreshSubscription.mockClear();
  logout.mockClear();
});

it("explica que la cuenta de la empresa está suspendida y quién la reactiva", () => {
  renderWith("29 Superfoods");

  expect(screen.getByRole("heading", { name: "Cuenta suspendida" })).toBeInTheDocument();
  expect(
    screen.getByText(
      "La cuenta de 29 Superfoods está suspendida. Para volver a usar Powip, el dueño tiene que registrar su tarjeta.",
    ),
  ).toBeInTheDocument();
});

it("sin nombre de empresa usa un texto genérico", () => {
  renderWith(null);

  expect(
    screen.getByText(
      "La cuenta de tu empresa está suspendida. Para volver a usar Powip, el dueño tiene que registrar su tarjeta.",
    ),
  ).toBeInTheDocument();
});

it("Volver a intentar relee el estado de acceso", async () => {
  renderWith("29 Superfoods");

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" })); });

  expect(refreshSubscription).toHaveBeenCalledTimes(1);
});

it("Cerrar sesión cierra la sesión y lleva al login", async () => {
  renderWith("29 Superfoods");

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })); });

  expect(logout).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/login");
});
