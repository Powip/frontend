import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VentasChatLayout from "@/app/comercial/ventas-chat/layout";
import GuionView from "@/components/ventas-chat/GuionView";
import ObjecionesView from "@/components/ventas-chat/ObjecionesView";
import * as content from "@/services/crmContentService";
import * as plan from "@/services/crmPlanService";

let mockRole = "ADMIN";
let mockPath = "/comercial/ventas-chat/bandeja";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
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
jest.mock("@/services/crmPlanService", () => ({
  ...jest.requireActual("@/services/crmPlanService"),
  getCrmAccess: jest.fn(),
}));
const c = content as jest.Mocked<typeof content>;
const p = plan as jest.Mocked<typeof plan>;
const allowed = (over: Partial<plan.CrmAccess> = {}): plan.CrmAccess => ({
  allowed: true, level: "admin", crm: true, pau: true, until: "2026-12-23", source: "subscription", ...over,
});

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  mockPath = "/comercial/ventas-chat/bandeja";
  p.getCrmAccess.mockResolvedValue(allowed());
});

describe("Ventas por chat · pestañas por rol", () => {
  it("el administrador ve todas las pestañas", async () => {
    wrap(<VentasChatLayout>x</VentasChatLayout>);
    const nav = await screen.findByRole("navigation", { name: "Secciones de Ventas por chat" });
    for (const label of ["Bandeja", "Pau", "Ficha de venta", "Guion y material", "Objeciones", "Equipo", "Auditoría", "Ajustes"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("quien no es administrador no ve las pestañas adminOnly, pero sí las demás", async () => {
    mockRole = "VENTAS";
    wrap(<VentasChatLayout>x</VentasChatLayout>);
    expect(await screen.findByRole("link", { name: "Bandeja" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ficha de venta" })).toBeInTheDocument();
    for (const label of ["Guion y material", "Objeciones", "Equipo", "Auditoría", "Ajustes"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });
});

describe("Ventas por chat · acceso y pago", () => {
  it("sin pago: muestra la pantalla de pago con enlace a Mi plan y no el contenido", async () => {
    p.getCrmAccess.mockResolvedValue(allowed({ allowed: false, reason: "not_paid", crm: false, pau: false, level: null }));
    wrap(<VentasChatLayout>contenido</VentasChatLayout>);
    const wall = await screen.findByTestId("crm-paywall");
    expect(wall).toHaveAttribute("data-reason", "not_paid");
    expect(screen.getByRole("link", { name: "Ver planes y pagar" })).toHaveAttribute("href", "/configuracion/plan");
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Secciones de Ventas por chat" })).not.toBeInTheDocument();
  });

  it("correo no permitido: bloqueado sin ofrecer pago", async () => {
    p.getCrmAccess.mockResolvedValue(allowed({ allowed: false, reason: "email", crm: false, pau: false }));
    wrap(<VentasChatLayout>contenido</VentasChatLayout>);
    expect(await screen.findByTestId("crm-paywall")).toHaveAttribute("data-reason", "email");
    expect(screen.queryByRole("link", { name: "Ver planes y pagar" })).not.toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("si la consulta falla, el CRM queda cerrado", async () => {
    p.getCrmAccess.mockRejectedValue(new Error("down"));
    wrap(<VentasChatLayout>contenido</VentasChatLayout>);
    expect(await screen.findByText("No pudimos confirmar tu plan")).toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("solo CRM: sin pestaña Pau y la ruta de Pau enseña cómo agregarlo", async () => {
    p.getCrmAccess.mockResolvedValue(allowed({ pau: false }));
    mockPath = "/comercial/ventas-chat/pau";
    wrap(<VentasChatLayout>pantalla de pau</VentasChatLayout>);
    expect(await screen.findByTestId("pau-paywall")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pau" })).not.toBeInTheDocument();
    expect(screen.queryByText("pantalla de pau")).not.toBeInTheDocument();
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
