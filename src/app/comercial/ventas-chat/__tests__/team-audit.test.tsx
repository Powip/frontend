import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditView from "@/components/ventas-chat/AuditView";
import * as teamService from "@/services/crmTeamService";
import type { Audit } from "@/types/crmTeam";

let mockRole = "ADMIN";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmTeamService", () => ({
  ...jest.requireActual("@/services/crmTeamService"),
  getAudit: jest.fn(),
  remindScript: jest.fn(),
}));
const team = teamService as jest.Mocked<typeof teamService>;

const AUDIT: Audit = {
  score: 64,
  sheets: [
    { id: "s1", name: "Collar luna", status: "ok", missing: [] },
    { id: "s2", name: "Aretes sol", status: "bad", missing: ["Precio", "Fotos"] },
  ],
  problems: [
    { severity: "info", code: "I1", title: "Aviso menor", detail: "d-info", href: null },
    { severity: "bad", code: "B1", title: "Sin plantillas aprobadas", detail: "d-bad", href: "/comercial/ventas-chat/seguimientos" },
    { severity: "warn", code: "W1", title: "Guion desactualizado", detail: "d-warn", href: null },
  ],
  script: {
    version: 3,
    items: [
      { userId: "u1", userName: "Ana", readVersion: 3, readAt: "2026-11-10T10:00:00Z", upToDate: true },
      { userId: "u2", userName: "Luis", readVersion: 1, readAt: null, upToDate: false },
      { userId: "u3", userName: "Eva", readVersion: null, readAt: null, upToDate: false },
    ],
  },
};

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuditView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  team.getAudit.mockResolvedValue(AUDIT);
  team.remindScript.mockResolvedValue({ ok: true });
});

describe("Auditoría", () => {
  it("muestra el puntaje y su explicación", async () => {
    setup();
    expect(await screen.findByTestId("score")).toHaveTextContent("64");
    expect(screen.getByRole("progressbar", { name: /puntaje/i })).toHaveAttribute("aria-valuenow", "64");
    expect(screen.getByText(/Casi listo/)).toBeInTheDocument();
  });

  it("ordena los problemas por gravedad y enlaza el href", async () => {
    setup();
    const list = await screen.findByTestId("problems");
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("data-severity"))).toEqual(["bad", "warn", "info"]);
    expect(within(items[0]).getByRole("link", { name: "Resolver" })).toHaveAttribute(
      "href",
      "/comercial/ventas-chat/seguimientos",
    );
    expect(within(items[1]).queryByRole("link")).toBeNull();
  });

  it("lista las fichas con lo que les falta y enlaza al guion", async () => {
    setup();
    const table = await screen.findByTestId("sheets");
    expect(table.textContent).toContain("Precio, Fotos");
    expect(within(table).getByRole("link", { name: "Aretes sol" })).toHaveAttribute(
      "href",
      "/comercial/ventas-chat/guion",
    );
  });

  it("Recordar llama a remind y queda «Avisado»", async () => {
    setup();
    const table = await screen.findByTestId("script-readers");
    expect(within(table).queryByRole("button", { name: "Recordar a Ana" })).toBeNull();
    fireEvent.click(within(table).getByRole("button", { name: "Recordar a Luis" }));
    await waitFor(() =>
      expect(team.remindScript).toHaveBeenCalledWith({ userId: "u2", userName: "Luis" }),
    );
    expect(await within(table).findByText("Avisado")).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Recordar a Luis" })).toBeNull();
    // La otra persona sigue pendiente.
    expect(within(table).getByRole("button", { name: "Recordar a Eva" })).toBeInTheDocument();
  });

  it("si remind falla no queda «Avisado»", async () => {
    team.remindScript.mockRejectedValue(new Error("falló"));
    setup();
    const table = await screen.findByTestId("script-readers");
    fireEvent.click(within(table).getByRole("button", { name: "Recordar a Luis" }));
    await waitFor(() => expect(team.remindScript).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(table).getByRole("button", { name: "Recordar a Luis" })).not.toBeDisabled(),
    );
    expect(within(table).queryByText("Avisado")).toBeNull();
  });

  it("no administrador: aviso y ninguna llamada", () => {
    mockRole = "VENTAS";
    setup();
    expect(screen.getByText("Solo un administrador puede ver esta sección")).toBeInTheDocument();
    expect(team.getAudit).not.toHaveBeenCalled();
  });
});
