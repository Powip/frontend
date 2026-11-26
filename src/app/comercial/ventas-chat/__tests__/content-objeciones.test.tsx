import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ObjecionesView from "@/components/ventas-chat/ObjecionesView";
import { formatRate, wonRate } from "@/components/ventas-chat/ContentLib";
import * as content from "@/services/crmContentService";
import type { Objection, ObjectionStats } from "@/types/crmContent";

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
const stats = (over: Partial<ObjectionStats> = {}): ObjectionStats => ({
  days: 30,
  total: 14,
  items: [
    { objectionId: "o1", name: "Está caro", uses: 10, conversations: 10, won: 5, byUser: [{ userId: "u2", userName: "Ana", uses: 3 }, { userId: "u3", userName: "Luis", uses: 7 }] },
    { objectionId: "o2", name: "Lo voy a pensar", uses: 4, conversations: 4, won: 4, byUser: [{ userId: "u2", userName: "Ana", uses: 4 }] },
  ],
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
    obj({ id: "o2", name: "Lo voy a pensar", response: "Te guardo el stock", position: 1 }),
    obj({ id: "o3", name: "Envío caro", response: "Hay envío gratis", position: 2, active: false }),
  ]);
  c.getObjectionStats.mockResolvedValue(stats());
  c.createObjection.mockResolvedValue(obj({ id: "o9" }));
  c.updateObjection.mockResolvedValue(obj());
  c.deleteObjection.mockResolvedValue();
});

describe("Objeciones · porcentajes", () => {
  it("wonRate y formatRate: «—» sin conversaciones", () => {
    expect(wonRate(1, 0)).toBeNull();
    expect(formatRate(0, 0)).toBe("—");
    expect(formatRate(5, 10)).toBe("50 %");
    expect(formatRate(1, 3)).toBe("33 %");
  });
});

describe("Objeciones · pantalla", () => {
  it("explica de dónde salen los números", async () => {
    setup();
    expect(await screen.findByText(/Los números salen de las veces que el equipo usa una respuesta/)).toBeInTheDocument();
  });

  it("tarjetas: total, la más usada y la mejor con mínimo de 5 conversaciones", async () => {
    setup();
    await screen.findAllByTestId("objection-row");
    await waitFor(() => expect(screen.getByTestId("card-total")).toHaveTextContent("14"));
    expect(screen.getByTestId("card-top")).toHaveTextContent("Está caro");
    // «Lo voy a pensar» tiene 100 % pero solo 4 conversaciones: no cuenta.
    const best = screen.getByTestId("card-best");
    expect(best).toHaveTextContent("Está caro");
    expect(best).toHaveTextContent("50 %");
    expect(best).not.toHaveTextContent("Lo voy a pensar");
  });

  it("si ninguna llega al mínimo, la tarjeta muestra «—» y la razón", async () => {
    c.getObjectionStats.mockResolvedValue(
      stats({ items: [{ objectionId: "o1", name: "Está caro", uses: 2, conversations: 2, won: 2, byUser: [] }], total: 2 }),
    );
    setup();
    await waitFor(() => expect(screen.getByTestId("card-total")).toHaveTextContent("2"));
    const best = screen.getByTestId("card-best");
    expect(best).toHaveTextContent("—");
    expect(best).toHaveTextContent("al menos 5 conversaciones");
  });

  it("tabla: usos, conversaciones, % con «—» sin datos y quién la usa más", async () => {
    setup();
    const rows = await screen.findAllByTestId("objection-row");
    await waitFor(() => expect(within(rows[0]).getByTestId("obj-rate")).toHaveTextContent("50 %"));
    expect(within(rows[0]).getByText("Luis")).toBeInTheDocument();
    expect(within(rows[1]).getByTestId("obj-rate")).toHaveTextContent("100 %");
    // La inactiva no tiene estadísticas: 0 / 0 → «—» y sin persona.
    expect(within(rows[2]).getByTestId("obj-rate")).toHaveTextContent("—");
    expect(within(rows[2]).getByText("Inactiva")).toBeInTheDocument();
  });

  it("crea una objeción", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva objeción/ }));
    fireEvent.change(await screen.findByLabelText("Objeción"), { target: { value: "No tengo plata" } });
    fireEvent.change(screen.getByLabelText("Respuesta"), { target: { value: "Podemos separarlo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar objeción" }));
    await waitFor(() => expect(c.createObjection).toHaveBeenCalledWith({ name: "No tengo plata", response: "Podemos separarlo" }));
  });

  it("edita, activa/desactiva y reordena", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Editar Está caro" }));
    fireEvent.change(await screen.findByLabelText("Respuesta"), { target: { value: "Nueva respuesta" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar objeción" }));
    await waitFor(() =>
      expect(c.updateObjection).toHaveBeenCalledWith("o1", { name: "Está caro", response: "Nueva respuesta" }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Activar Envío caro" }));
    await waitFor(() => expect(c.updateObjection).toHaveBeenCalledWith("o3", { active: true }));

    fireEvent.click(screen.getByRole("button", { name: "Bajar Está caro" }));
    await waitFor(() => expect(c.updateObjection).toHaveBeenCalledWith("o1", { position: 1 }));
    expect(c.updateObjection).toHaveBeenCalledWith("o2", { position: 0 });
  });

  it("eliminar pide confirmación", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Está caro" }));
    expect(c.deleteObjection).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("no se puede deshacer");
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(c.deleteObjection).toHaveBeenCalledWith("o1"));
  });
});
