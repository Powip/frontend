import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../Sidebar";
import { getLiveAvailability } from "@/lib/liveAvailability";

let mockStore = "store-a";
let mockRole = "ADMINISTRADOR";
jest.mock("@/lib/liveAvailability", () => ({ getLiveAvailability: jest.fn() }));
jest.mock("@/services/commercialLeadsService", () => ({
  getCommercialLeadCapabilities: async () => ({ enabled: false }),
}));
jest.mock("@/services/advertisingV22Service", () => ({
  adsGet: async () => ({ capabilities: { view: false } }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "fixture",
      company: { id: "company" },
      user: { id: "user", role: mockRole, permissions: [] },
    },
    selectedStoreId: mockStore,
    logout: jest.fn(),
    hasPermission: () => false,
  }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/ventas",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStore = "store-a";
  mockRole = "ADMINISTRADOR";
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = () => (
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>
  );
  return { ...render(element()), element };
}

test.each(["disabled", "unavailable"])(
  "%s Live preserves sales navigation and creates no Live link",
  async (state) => {
    (getLiveAvailability as jest.Mock).mockImplementation(() =>
      state === "disabled"
        ? Promise.resolve({ available: false })
        : Promise.reject(new Error("unavailable")),
    );
    mount();
    await waitFor(() =>
      expect(getLiveAvailability).toHaveBeenCalledWith("store-a", expect.any(AbortSignal)),
    );
    expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute("href", "/ventas");
    expect(screen.getByRole("link", { name: "Cotizaciones" })).toHaveAttribute(
      "href",
      "/cotizaciones",
    );
    expect(screen.getByRole("link", { name: "Registrar venta" })).toHaveAttribute(
      "href",
      "/registrar-venta",
    );
    expect(screen.queryByRole("link", { name: "POWIP Live" })).not.toBeInTheDocument();
  },
);

test("only explicit server availability shows Live; a store or role switch hides the previous grant", async () => {
  let resolveNext!: (value: { available: boolean }) => void;
  (getLiveAvailability as jest.Mock).mockResolvedValueOnce({ available: true }).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveNext = resolve;
      }),
  );
  const view = mount();
  expect(await screen.findByRole("link", { name: "POWIP Live" })).toHaveAttribute("href", "/live");
  mockStore = "store-b";
  view.rerender(view.element());
  expect(screen.queryByRole("link", { name: "POWIP Live" })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(getLiveAvailability).toHaveBeenCalledWith("store-b", expect.any(AbortSignal)),
  );
  resolveNext({ available: false });
  await waitFor(() =>
    expect(screen.queryByRole("link", { name: "POWIP Live" })).not.toBeInTheDocument(),
  );
  mockRole = "VENTAS";
  view.rerender(view.element());
  expect(screen.queryByRole("link", { name: "POWIP Live" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
  fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
  expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute("href", "/ventas");
});
