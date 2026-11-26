import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FichaView from "@/components/ventas-chat/FichaView";
import * as content from "@/services/crmContentService";
import type { Script, Sheet } from "@/types/crmContent";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u2", name: "Ana", role: "VENTAS" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  getScript: jest.fn(),
  markScriptRead: jest.fn(),
  listSheets: jest.fn(),
  listMaterials: jest.fn(),
}));
const c = content as jest.Mocked<typeof content>;

const script = (over: Partial<Script> = {}): Script => ({
  steps: [
    { name: "Saludo", message: "Hola {nombre}", question: "¿Qué buscas?" },
    { name: "Cierre", message: "Te lo separo", question: "" },
  ],
  version: 3,
  note: "Nuevo cierre",
  updatedAt: "2026-11-18T15:00:00.000Z",
  updatedByName: "Marta",
  myReadVersion: 3,
  ...over,
});
const sheet = (over: Partial<Sheet> = {}): Sheet => ({
  id: "s1",
  name: "Polo básico",
  price: "S/ 50",
  forWhom: "Uso diario",
  highlights: "Algodón pima",
  alternatives: "Polo premium",
  complements: "Gorra",
  active: true,
  materials: [{ id: "m1", sheetId: "s1", kind: "photo", title: "Foto frontal", url: "https://x.pe/f.jpg", position: 0 }],
  updatedAt: "2026-11-18T15:00:00.000Z",
  ...over,
});

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FichaView />
    </QueryClientProvider>,
  );

const writeText = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText } });
  c.getScript.mockResolvedValue(script());
  c.listSheets.mockResolvedValue([
    sheet(),
    sheet({ id: "s2", name: "Gorra clásica", price: null, active: true, materials: [] }),
    sheet({ id: "s3", name: "Producto apagado", active: false }),
  ]);
  c.listMaterials.mockResolvedValue([
    { id: "g1", sheetId: null, kind: "pdf", title: "Catálogo", url: "https://x.pe/cat.pdf", position: 0 },
  ]);
  c.markScriptRead.mockResolvedValue(script());
});

describe("Ficha", () => {
  it("lista productos activos y muestra el detalle de solo lectura del primero", async () => {
    setup();
    const list = await screen.findByRole("list", { name: "Lista de productos" });
    expect(within(list).getByText("Polo básico")).toBeInTheDocument();
    expect(within(list).getByText("Gorra clásica")).toBeInTheDocument();
    expect(within(list).queryByText("Producto apagado")).not.toBeInTheDocument();
    const detail = screen.getByRole("article", { name: "Polo básico" });
    for (const t of ["S/ 50", "Uso diario", "Algodón pima", "Polo premium", "Gorra"]) {
      expect(within(detail).getByText(t)).toBeInTheDocument();
    }
    expect(within(detail).getByRole("link", { name: /Foto frontal/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/Pau lee automáticamente el guion/)).toBeInTheDocument();
  });

  it("elegir otro producto cambia el detalle y el buscador filtra", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Gorra clásica/ }));
    expect(screen.getByRole("article", { name: "Gorra clásica" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar producto"), { target: { value: "gorra" } });
    await waitFor(() => expect(c.listSheets).toHaveBeenCalledWith("gorra"));
  });

  it("muestra el guion en pasos y el material del negocio", async () => {
    setup();
    const steps = await screen.findAllByTestId("ficha-step");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent("1. Saludo");
    expect(steps[0]).toHaveTextContent("¿Qué buscas?");
    expect(await screen.findByRole("list", { name: "Material del negocio" })).toBeInTheDocument();
  });

  it("copiar pone el texto en el portapapeles", async () => {
    setup();
    const detail = await screen.findByRole("article", { name: "Polo básico" });
    fireEvent.click(within(detail).getByRole("button", { name: "Copiar qué destacar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Algodón pima"));
    fireEvent.click(within(detail).getByRole("button", { name: "Copiar enlace de Foto frontal" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Foto frontal: https://x.pe/f.jpg"));
  });

  it("sin guion nuevo no hay banner", async () => {
    setup();
    await screen.findAllByTestId("ficha-step");
    expect(screen.queryByText(/Hay un guion nuevo/)).not.toBeInTheDocument();
  });

  it("banner «Hay un guion nuevo» y «Ya lo leí» llama a read", async () => {
    c.getScript.mockResolvedValue(script({ myReadVersion: 2 }));
    c.markScriptRead.mockResolvedValue(script({ myReadVersion: 3 }));
    setup();
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Hay un guion nuevo (versión 3)");
    expect(banner).toHaveTextContent("Nuevo cierre");
    fireEvent.click(within(banner).getByRole("button", { name: "Ya lo leí" }));
    await waitFor(() => expect(c.markScriptRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/Hay un guion nuevo/)).not.toBeInTheDocument());
  });

  it("sin guion todavía no hay banner y avisa", async () => {
    c.getScript.mockResolvedValue(script({ steps: [], version: 0, myReadVersion: 0, note: null }));
    setup();
    expect(await screen.findByText(/Aún no hay guion/)).toBeInTheDocument();
    expect(screen.queryByText(/Hay un guion nuevo/)).not.toBeInTheDocument();
  });
});
