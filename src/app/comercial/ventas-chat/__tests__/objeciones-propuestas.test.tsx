import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ObjecionesView from "@/components/ventas-chat/ObjecionesView";
import * as content from "@/services/crmContentService";
import type { Objection } from "@/types/crmContent";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: "ADMIN" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  listObjections: jest.fn(),
  getObjectionStats: jest.fn(),
  createObjection: jest.fn(),
  updateObjection: jest.fn(),
  deleteObjection: jest.fn(),
}));
const c = content as jest.Mocked<typeof content>;

const obj = (over: Partial<Objection> = {}): Objection => ({
  id: "o1",
  name: "Está caro",
  response: "Mira el valor que recibes",
  position: 0,
  active: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  proposedByName: null,
  ...over,
});

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ObjecionesView />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  c.listObjections.mockResolvedValue([
    obj(),
    obj({ id: "p1", name: "¿Envían a provincia?", response: "Sí, a todo el Perú", position: 1, active: false, proposedByName: "Ana Vendedora" }),
    obj({ id: "o3", name: "Envío caro", response: "Hay envío gratis", position: 2, active: false }),
  ]);
  c.getObjectionStats.mockResolvedValue({ days: 30, total: 0, items: [] });
  c.updateObjection.mockResolvedValue(obj());
  c.deleteObjection.mockResolvedValue();
});

describe("Objeciones · propuestas por aprobar", () => {
  it("separa las propuestas (con autor) de la tabla; una inactiva normal sigue en la tabla", async () => {
    setup();
    const section = within(await screen.findByRole("region", { name: "Propuestas por aprobar" }));
    const rows = section.getAllByTestId("proposal-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("¿Envían a provincia?");
    expect(rows[0]).toHaveTextContent("Sí, a todo el Perú");
    expect(rows[0]).toHaveTextContent("Propuesta de Ana Vendedora");
    const table = screen.getAllByTestId("objection-row").map((r) => r.textContent ?? "");
    expect(table).toHaveLength(2);
    expect(table.some((t) => t.includes("Envían a provincia"))).toBe(false);
    expect(table.some((t) => t.includes("Envío caro") && t.includes("Inactiva"))).toBe(true);
  });

  it("sin propuestas no pinta la sección", async () => {
    c.listObjections.mockResolvedValue([obj()]);
    setup();
    await screen.findByText("Está caro");
    expect(screen.queryByText("Propuestas por aprobar")).not.toBeInTheDocument();
  });

  it("Aprobar activa la objeción", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Aprobar ¿Envían a provincia?" }));
    await waitFor(() => expect(c.updateObjection).toHaveBeenCalledWith("p1", { active: true }));
  });

  it("Descartar pide confirmación y la elimina", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Descartar ¿Envían a provincia?" }));
    const dlg = within(await screen.findByRole("alertdialog"));
    expect(dlg.getByText("¿Descartar esta propuesta?")).toBeInTheDocument();
    expect(c.deleteObjection).not.toHaveBeenCalled();
    fireEvent.click(dlg.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(c.deleteObjection).toHaveBeenCalledWith("p1"));
  });

  it("Editar abre el formulario con los datos y guarda sin aprobarla", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Editar propuesta ¿Envían a provincia?" }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByLabelText("Respuesta")).toHaveValue("Sí, a todo el Perú");
    fireEvent.change(dlg.getByLabelText("Respuesta"), { target: { value: "Sí, con Olva y Shalom" } });
    fireEvent.click(dlg.getByRole("button", { name: "Guardar objeción" }));
    await waitFor(() =>
      expect(c.updateObjection).toHaveBeenCalledWith("p1", {
        name: "¿Envían a provincia?",
        response: "Sí, con Olva y Shalom",
      }),
    );
  });
});
