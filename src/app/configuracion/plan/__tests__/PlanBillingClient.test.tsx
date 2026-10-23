import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import * as service from "@/services/planBillingService";
import type { PlanBilling } from "@/types/planBilling";
import PlanBillingClient from "../PlanBillingClient";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/planBillingService", () => ({
  ...jest.requireActual("@/services/planBillingService"),
  fetchPlanBilling: jest.fn(),
  previewPlanChange: jest.fn(),
  changePlan: jest.fn(),
  undoPlanChange: jest.fn(),
  addAddOn: jest.fn(),
  removeAddOn: jest.fn(),
  cancelSubscription: jest.fn(),
}));

const basic = { id: "p-basic", name: "Basic", price: 99, durationInDays: 30 };
const medium = { id: "p-medium", name: "Medium", price: 189, durationInDays: 30 };

const base: PlanBilling = {
  mode: "FLOW_ACTIVE",
  isOwner: true,
  currency: "PEN",
  plan: basic,
  paidUntil: "2026-11-21",
  nextChargeDate: "2026-11-22",
  nextChargeTotal: 99,
  firstChargeDate: null,
  pendingPlan: null,
  addOns: [],
  payments: [],
  availablePlans: [medium],
  availableAddOns: [{ id: "a-sunat", code: "sunat", name: "SUNAT", description: null, amount: 29 }],
};

const asRole = (role: string) =>
  jest.mocked(useAuth).mockReturnValue({ auth: { user: { id: "u1", role } } } as unknown as ReturnType<typeof useAuth>);

describe("Plan y facturación", () => {
  beforeEach(() => {
    asRole("ADMINISTRADOR");
    jest.mocked(service.fetchPlanBilling).mockResolvedValue(base);
  });
  afterEach(() => jest.clearAllMocks());

  it("un usuario que no es administrador ve el aviso y no consulta nada", () => {
    asRole("USUARIO");
    render(<PlanBillingClient />);
    expect(screen.getByText("Solo el administrador de la cuenta puede ver el plan.")).toBeInTheDocument();
    expect(service.fetchPlanBilling).not.toHaveBeenCalled();
  });

  it("Flow al día: plan, próximo cobro en soles y las acciones", async () => {
    render(<PlanBillingClient />);
    expect(await screen.findByText("Plan Basic")).toBeInTheDocument();
    expect(screen.getByText(/Pagas con Flow/)).toBeInTheDocument();
    expect(screen.getAllByText(/S\/ 99\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Cambiar plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Darse de baja" })).toBeInTheDocument();
  });

  it("subir de plan muestra el monto exacto del preview antes de confirmar", async () => {
    jest.mocked(service.previewPlanChange).mockResolvedValue({
      direction: "UP", balance: 45.5, currency: "PEN", startsOn: null, nextChargeTotal: 189,
    });
    jest.mocked(service.changePlan).mockResolvedValue({ ...base, plan: medium });
    render(<PlanBillingClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Cambiar plan" }));
    fireEvent.click(await screen.findByRole("button", { name: /Medium/ }));

    expect(await screen.findByText("S/ 45.50")).toBeInTheDocument();
    expect(service.changePlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => expect(service.changePlan).toHaveBeenCalledWith("p-medium"));
  });

  it("bajar de plan avisa que hoy no se cobra y hasta cuándo sigue el plan actual", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({ ...base, plan: medium, availablePlans: [basic] });
    jest.mocked(service.previewPlanChange).mockResolvedValue({
      direction: "DOWN", balance: null, currency: "PEN", startsOn: "2026-11-22", nextChargeTotal: 99,
    });
    render(<PlanBillingClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Cambiar plan" }));
    fireEvent.click(await screen.findByRole("button", { name: /Basic/ }));

    expect(await screen.findByText(/Hoy no se cobra ni se devuelve nada/)).toBeInTheDocument();
    expect(screen.getByText(/Hasta ese día sigues con Medium/)).toBeInTheDocument();
  });

  it("con una bajada programada muestra el aviso y Deshacer la cancela", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({
      ...base, plan: medium, pendingPlan: { planId: "p-basic", name: "Basic", price: 99, startsOn: "2026-11-22" },
    });
    jest.mocked(service.undoPlanChange).mockResolvedValue({ ...base, plan: medium });
    render(<PlanBillingClient />);

    expect(await screen.findByText(/pasas a Basic/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(service.undoPlanChange).toHaveBeenCalled());
  });

  it("agregar un add-on dice que hoy no se cobra y cuánto pasa el próximo cobro", async () => {
    jest.mocked(service.addAddOn).mockResolvedValue(base);
    render(<PlanBillingClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    expect(await screen.findByText(/Hoy no se cobra nada/)).toBeInTheDocument();
    expect(screen.getByText(/S\/ 128\.00/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Agregar" }).at(-1) as HTMLElement);
    await waitFor(() => expect(service.addAddOn).toHaveBeenCalledWith("a-sunat"));
  });

  it("un add-on con baja programada dice hasta cuándo se tiene y se puede deshacer", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({
      ...base,
      addOns: [{ id: "a-sunat", code: "sunat", name: "SUNAT", amount: 29, endsOn: "2026-11-21" }],
      availableAddOns: [],
    });
    jest.mocked(service.addAddOn).mockResolvedValue(base);
    render(<PlanBillingClient />);

    expect(await screen.findByText(/Lo tienes hasta el/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(service.addAddOn).toHaveBeenCalledWith("a-sunat"));
  });

  it("darse de baja pide confirmar con el texto del fin del período", async () => {
    jest.mocked(service.cancelSubscription).mockResolvedValue({ ...base, mode: "FLOW_CANCELING" });
    render(<PlanBillingClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Darse de baja" }));
    expect(await screen.findByText(/No se te cobra más/)).toBeInTheDocument();
    expect(service.cancelSubscription).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));
    await waitFor(() => expect(service.cancelSubscription).toHaveBeenCalled());
  });

  it("sin Flow: el dueño ve Pasarme a Flow; un administrador que no es dueño ve el texto", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({ ...base, mode: "NO_FLOW", nextChargeDate: null });
    const { unmount } = render(<PlanBillingClient />);
    expect(await screen.findByRole("link", { name: "Pasarme a Flow" })).toHaveAttribute("href", "/pasate-a-flow");
    expect(screen.queryByRole("button", { name: "Cambiar plan" })).not.toBeInTheDocument();
    unmount();

    jest.mocked(service.fetchPlanBilling).mockResolvedValue({ ...base, mode: "NO_FLOW", isOwner: false });
    render(<PlanBillingClient />);
    expect(await screen.findByText("Lo tiene que hacer el dueño de la cuenta.")).toBeInTheDocument();
  });

  it("migración programada: primer cobro y sin 'Darse de baja'", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({
      ...base, mode: "FLOW_SCHEDULED", firstChargeDate: "2026-11-05", nextChargeDate: null,
    });
    render(<PlanBillingClient />);
    expect(await screen.findByText(/Tu primer cobro con Flow es el/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Darse de baja" })).not.toBeInTheDocument();
  });

  it("exenta: sin acciones de cobro", async () => {
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({ ...base, mode: "EXEMPT" });
    render(<PlanBillingClient />);
    expect(await screen.findByText("Plan Basic")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Darse de baja" })).not.toBeInTheDocument();
  });

  it("si una operación falla muestra el mensaje por código y vuelve a leer el estado", async () => {
    const { toast } = jest.requireMock("sonner");
    jest.mocked(service.removeAddOn).mockRejectedValue({ isAxiosError: true, response: { data: { code: "FLOW_UNAVAILABLE" } } });
    jest.mocked(service.fetchPlanBilling).mockResolvedValue({
      ...base, addOns: [{ id: "a-sunat", code: "sunat", name: "SUNAT", amount: 29, endsOn: null }], availableAddOns: [],
    });
    render(<PlanBillingClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Quitar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quitar add-on" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(service.fetchPlanBilling).toHaveBeenCalledTimes(2);
  });
});
