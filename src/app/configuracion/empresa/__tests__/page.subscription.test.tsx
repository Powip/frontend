import { render, screen } from "@testing-library/react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import EmpresaPage from "../page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("axios");
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const company = {
  id: "company-1",
  name: "Aranni",
  billing_address: "Av. Siempre Viva 123",
  phone: "999",
  billing_email: "facturas@test.pe",
  currency: "PEN",
  iva: 18,
};

describe("Configuración → Empresa", () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      auth: { accessToken: "fixture-access-token", user: { id: "user-1" }, company: { id: "company-1" } },
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(axios.get).mockResolvedValue({ data: company });
  });

  afterEach(() => jest.clearAllMocks());

  it("ya no muestra la tarjeta de suscripción (vive en Plan y facturación) ni consulta /subscriptions", async () => {
    render(<EmpresaPage />);

    expect(await screen.findByText("Información de la empresa")).toBeInTheDocument();
    expect(screen.queryByText("Suscripción activa")).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("/subscriptions/"));
  });
});
