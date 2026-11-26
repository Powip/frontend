import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../Sidebar";

let mockEmail = "joel@aranni.com.pe";
jest.mock("@/lib/liveAvailability", () => ({
  getLiveAvailability: async () => ({ available: false }),
}));
jest.mock("@/services/commercialLeadsService", () => ({
  getCommercialLeadCapabilities: async () => ({ enabled: false }),
}));
jest.mock("@/services/advertisingV22Service", () => ({
  adsGet: async () => ({ capabilities: { view: false } }),
}));
jest.mock("@/services/crmPlanService", () => ({ getCrmAccess: async () => ({ allowed: false }) }));
jest.mock("@/components/whatsapp/WhatsAppNotificationsBell", () => ({
  WhatsAppNotificationsBell: () => <div data-testid="wa-bell" />,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "fixture",
      company: { id: "company" },
      user: { id: "user", email: mockEmail, role: "ADMINISTRADOR", permissions: [] },
    },
    selectedStoreId: "store",
    logout: jest.fn(),
    hasPermission: () => false,
  }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/configuracion",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

function mount(email: string) {
  mockEmail = email;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );
  // El submenú «Configuración» ya viene abierto por la ruta actual.
  if (!screen.queryByRole("link", { name: "Usuarios y roles" })) {
    fireEvent.click(screen.getByRole("button", { name: /Configuración/ }));
  }
}

const whatsappLinks = () =>
  screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/configuracion/whatsapp"));

it("Joel ve el enlace de WhatsApp y la campanita", () => {
  mount("joel@aranni.com.pe");
  expect(whatsappLinks()).toHaveLength(1);
  expect(screen.getByTestId("wa-bell")).toBeInTheDocument();
});

it.each(["demo@tienda.pe", "cuentaprueba@gmail.com"])("%s no ve enlace ni campanita", (email) => {
  mount(email);
  expect(screen.getByRole("link", { name: "Usuarios y roles" })).toBeInTheDocument();
  expect(whatsappLinks()).toHaveLength(0);
  expect(screen.queryByTestId("wa-bell")).not.toBeInTheDocument();
});
