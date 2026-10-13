import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import SinPlanPage from "../page";

const mockPush = jest.fn();
const mockLogout = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/components/modals/EnterpriseContactModal", () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Contactar con ventas">
        <button type="button" onClick={onClose}>
          Cerrar contacto
        </button>
      </div>
    ) : null,
}));

interface CatalogPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}

const catalog: CatalogPlan[] = [
  { id: "basic", name: "Basic", description: "Plan mensual", price: 99, durationInDays: 30 },
  {
    id: "basic-annual",
    name: "Basic Anual",
    description: "Plan anual",
    price: 990,
    durationInDays: 365,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Solución para grandes empresas",
    price: 0,
    durationInDays: 30,
  },
];

const request = jest.mocked(axiosAuth.get);
const response = (plans: CatalogPlan[]) => ({ data: plans }) as AxiosResponse<CatalogPlan[]>;

function setSession(accessToken: string | null = "fixture-access-token") {
  const value: ReturnType<typeof useAuth> = {
    auth:
      accessToken === null
        ? null
        : {
            accessToken,
            user: {
              id: "fixture-user",
              email: "plans@fixture.invalid",
              role: "USUARIO",
              permissions: [],
            },
            company: null,
            subscription: null,
            exp: 9999999999,
          },
    logout: mockLogout,
    loading: false,
    login: jest.fn(async () => null),
    refreshSession: jest.fn(async () => true),
    updateCompany: jest.fn(),
    selectedStoreId: null,
    setSelectedStore: jest.fn(),
    inventories: [],
    refreshInventories: jest.fn(async () => undefined),
    hasPermission: jest.fn(() => false),
    refreshSubscription: jest.fn(async () => undefined),
  };
  jest.mocked(useAuth).mockReturnValue(value);
}

function planCard(name: string) {
  const heading = screen.getByRole("heading", { name: `PLAN ${name}` });
  const card = heading.closest('[data-slot="card"]');
  if (!card) throw new Error(`Tarjeta del plan ${name} ausente`);
  return within(card as HTMLElement);
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  request.mockReset();
  request.mockResolvedValue(response(catalog));
  setSession();
});

it("contrata el plan anual navegando al onboarding completo con el nombre codificado", async () => {
  render(<SinPlanPage />);
  await screen.findByRole("heading", { name: "PLAN Basic Anual" });
  fireEvent.click(planCard("Basic Anual").getByRole("button", { name: "Contratar" }));
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/onboarding?planName=Basic%20Anual");
  expect(mockLogout).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledWith(`${GATEWAY.subscription}/plans`, {
    signal: expect.any(AbortSignal),
  });
});

it("muestra el período de cobro según la duración del plan y conserva el precio del catálogo", async () => {
  render(<SinPlanPage />);
  await screen.findByRole("heading", { name: "PLAN Basic Anual" });
  expect(planCard("Basic").getByText("S/ 99")).toBeInTheDocument();
  expect(planCard("Basic").getByText(/^\/\s*mes$/)).toBeInTheDocument();
  expect(planCard("Basic").queryByText(/^\/\s*año$/)).not.toBeInTheDocument();
  expect(planCard("Basic Anual").getByText("S/ 990")).toBeInTheDocument();
  expect(planCard("Basic Anual").getByText(/^\/\s*año$/)).toBeInTheDocument();
  expect(planCard("Basic Anual").queryByText(/^\/\s*mes$/)).not.toBeInTheDocument();
});

it("Enterprise abre contacto con ventas y no inicia un checkout de pago", async () => {
  render(<SinPlanPage />);
  await screen.findByRole("heading", { name: "PLAN Enterprise" });
  expect(
    planCard("Enterprise").queryByRole("button", { name: "Contratar" }),
  ).not.toBeInTheDocument();
  fireEvent.click(planCard("Enterprise").getByRole("button", { name: "Contactar con ventas" }));
  expect(screen.getByRole("dialog", { name: "Contactar con ventas" })).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Cerrar contacto" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("explica el fallo del catálogo y permite recuperar los planes sin recargar la página", async () => {
  request.mockRejectedValueOnce(new Error("Fixture catalog unavailable"));
  render(<SinPlanPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los planes.");
  expect(screen.queryByRole("heading", { name: "PLAN Basic" })).not.toBeInTheDocument();
  expect(toast.error).toHaveBeenCalledTimes(1);
  const firstSignal = request.mock.calls[0]?.[1]?.signal;

  fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de planes" }));
  await screen.findByRole("heading", { name: "PLAN Basic" });
  expect(request).toHaveBeenCalledTimes(2);
  expect(firstSignal?.aborted).toBe(true);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each([null, ""])("no consulta el catálogo sin un token de sesión (%s)", (token) => {
  setSession(token);
  render(<SinPlanPage />);
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "PLAN Basic" })).not.toBeInTheDocument();
});

it.each(["resolve", "reject"] as const)(
  "ignora una respuesta tardía (%s) de la sesión anterior al cargar un catálogo nuevo",
  async (outcome) => {
    const pending = deferred<AxiosResponse<CatalogPlan[]>>();
    const freshCatalog: CatalogPlan[] = [
      {
        id: "medium",
        name: "Medium",
        description: "Catálogo actual",
        price: 189,
        durationInDays: 30,
      },
    ];
    request.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(freshCatalog));
    const page = render(<SinPlanPage />);
    const oldSignal = request.mock.calls[0]?.[1]?.signal;
    expect(oldSignal?.aborted).toBe(false);

    setSession("fixture-new-session-token");
    page.rerender(<SinPlanPage />);
    await screen.findByRole("heading", { name: "PLAN Medium" });
    expect(oldSignal?.aborted).toBe(true);

    await act(async () => {
      if (outcome === "resolve") pending.resolve(response(catalog));
      else pending.reject(new Error("Fixture late request failed"));
      await pending.promise.catch(() => undefined);
    });

    expect(screen.getByRole("heading", { name: "PLAN Medium" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PLAN Basic Anual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(2);
  },
);

it("cancela la consulta pendiente cuando se desmonta la selección de planes", async () => {
  const pending = deferred<AxiosResponse<CatalogPlan[]>>();
  request.mockReturnValueOnce(pending.promise);
  const page = render(<SinPlanPage />);
  const signal = request.mock.calls[0]?.[1]?.signal;
  page.unmount();
  expect(signal?.aborted).toBe(true);

  await act(async () => {
    pending.reject(new Error("Fixture canceled request failed"));
    await pending.promise.catch(() => undefined);
  });
  await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
});
