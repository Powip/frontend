import { render, screen } from "@testing-library/react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMySubscription } from "@/services/onboardingService";
import EmpresaPage from "../page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/services/onboardingService", () => ({ fetchMySubscription: jest.fn() }));
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

describe("Configuración → Empresa: suscripción", () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      auth: {
        accessToken: "fixture-access-token",
        user: { id: "user-1" },
        company: { id: "company-1" },
        subscription: { id: "sub-1" },
      },
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(axios.get).mockResolvedValue({ data: company });
    jest.mocked(fetchMySubscription).mockResolvedValue({
      id: "sub-1",
      status: "ACTIVE",
      gateway: "FLOW",
      autoRenewal: true,
      startDate: "2026-10-05",
      endDate: "2026-11-04",
      plan: { id: "plan-1", name: "Medium", price: 189, durationInDays: 30 },
      addOns: [],
    });
  });

  afterEach(() => jest.clearAllMocks());

  it("lee el plan de /subscriptions/me con la sesión, no por id sin token", async () => {
    render(<EmpresaPage />);

    expect(await screen.findByText(/Plan Medium/)).toBeInTheDocument();
    expect(fetchMySubscription).toHaveBeenCalledWith("fixture-access-token");
    expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining("/subscriptions/"));
  });
});
