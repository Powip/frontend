import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VentasChatLayout from "@/app/comercial/ventas-chat/layout";
import GuionView from "@/components/ventas-chat/GuionView";
import ObjecionesView from "@/components/ventas-chat/ObjecionesView";
import * as content from "@/services/crmContentService";

let mockRole = "ADMIN";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/comercial/ventas-chat/bandeja",
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  getScript: jest.fn(),
  getScriptReads: jest.fn(),
  listMaterials: jest.fn(),
  listSheets: jest.fn(),
  listObjections: jest.fn(),
  getObjectionStats: jest.fn(),
}));
const c = content as jest.Mocked<typeof content>;

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
});

describe("Ventas por chat · pestañas por rol", () => {
  it("el administrador ve todas las pestañas", () => {
    wrap(<VentasChatLayout>x</VentasChatLayout>);
    const nav = screen.getByRole("navigation", { name: "Secciones de Ventas por chat" });
    for (const label of ["Bandeja", "Ficha", "Guion y material", "Objeciones", "Equipo", "Auditoría", "Ajustes"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("quien no es administrador no ve las pestañas adminOnly, pero sí las demás", () => {
    mockRole = "VENTAS";
    wrap(<VentasChatLayout>x</VentasChatLayout>);
    expect(screen.getByRole("link", { name: "Bandeja" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ficha" })).toBeInTheDocument();
    for (const label of ["Guion y material", "Objeciones", "Equipo", "Auditoría", "Ajustes"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });
});

describe("Páginas adminOnly por URL", () => {
  it("Guion: un no administrador ve el aviso y no se llama a la API", () => {
    mockRole = "VENTAS";
    wrap(<GuionView />);
    expect(screen.getByText(/Solo un administrador puede ver esta sección/)).toBeInTheDocument();
    expect(c.getScript).not.toHaveBeenCalled();
    expect(c.getScriptReads).not.toHaveBeenCalled();
  });

  it("Objeciones: un no administrador ve el aviso y no se llama a la API", () => {
    mockRole = "VENTAS";
    wrap(<ObjecionesView />);
    expect(screen.getByText(/Solo un administrador puede ver esta sección/)).toBeInTheDocument();
    expect(c.listObjections).not.toHaveBeenCalled();
    expect(c.getObjectionStats).not.toHaveBeenCalled();
  });
});
