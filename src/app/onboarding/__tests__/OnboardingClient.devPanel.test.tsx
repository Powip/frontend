/**
 * Tests: modo desarrollo del onboarding (app/onboarding/OnboardingClient.tsx)
 *
 * Comportamiento verificado:
 * 1. El panel solo aparece con NODE_ENV=development.
 * 2. Sin sesión, "Cargar datos demo" carga planes y add-ons de ejemplo y
 *    preselecciona Medium, para recorrer los pasos con contenido.
 * 3. Desde el paso Pago se previsualizan sus estados (Confirmando, Pendiente, Error).
 * 4. El paso "¡Listo!" muestra una suscripción demo con el plan y los add-ons elegidos.
 * 5. Continuar desde el paso Plan sale del paso forzado y sigue el flujo real.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import OnboardingClient from "../OnboardingClient";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: null, login: jest.fn(), refreshSession: jest.fn() }),
}));

jest.mock("@/services/onboardingService", () => ({
  fetchAddOns: jest.fn(),
  fetchPlans: jest.fn(),
}));

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const env = process.env as Record<string, string | undefined>;
const originalEnv = env.NODE_ENV;

const devPanel = () => screen.getByRole("toolbar", { name: "Modo desarrollo del onboarding" });
const clickDev = (name: string | RegExp) =>
  fireEvent.click(within(devPanel()).getByRole("button", { name }));

describe("OnboardingClient — modo desarrollo", () => {
  afterEach(() => {
    env.NODE_ENV = originalEnv;
  });

  it("no muestra el panel fuera de desarrollo", () => {
    render(<OnboardingClient />);

    expect(screen.queryByRole("toolbar", { name: /Modo desarrollo/ })).not.toBeInTheDocument();
  });

  describe("en desarrollo", () => {
    beforeEach(() => {
      env.NODE_ENV = "development";
    });

    it("recorre los pasos con datos demo y previsualiza los estados del pago", () => {
      render(<OnboardingClient />);
      expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument();

      clickDev("Cargar datos demo");
      clickDev("Step 2");
      fireEvent.click(screen.getByRole("button", { name: /Integración Courier/ }));
      expect(screen.getByText("S/ 218/mes")).toBeInTheDocument();

      clickDev("Step 3");
      expect(screen.getByText("Resumen de tu suscripción", { selector: "h3" })).toBeInTheDocument();
      expect(screen.getAllByText("S/ 218/mes")).toHaveLength(2);
      expect(within(devPanel()).getByRole("button", { name: "Resumen" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      clickDev("Confirmando");
      expect(screen.getByText("Confirmando tu pago...")).toBeInTheDocument();
      clickDev("Pendiente");
      expect(screen.getByText("Tu pago está en proceso")).toBeInTheDocument();
      clickDev("Error");
      expect(screen.getByText("Ocurrió un error inesperado.")).toBeInTheDocument();

      clickDev("Step 4");
      expect(screen.getByText("Integración Courier")).toBeInTheDocument();
      expect(screen.getByText("+S/ 29")).toBeInTheDocument();
    });

    it("al continuar desde el paso Plan sigue el flujo real", () => {
      render(<OnboardingClient />);
      clickDev("Cargar datos demo");
      clickDev("Step 2");

      fireEvent.click(screen.getByRole("button", { name: /^Continuar/ }));

      expect(screen.getByText("Resumen de tu suscripción", { selector: "h3" })).toBeInTheDocument();
      expect(within(devPanel()).queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });
  });
});
