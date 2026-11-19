import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GuionView from "@/components/ventas-chat/GuionView";
import * as content from "@/services/crmContentService";
import type { Material, Script, Sheet } from "@/types/crmContent";

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
  getScript: jest.fn(),
  saveScript: jest.fn(),
  getScriptReads: jest.fn(),
  listMaterials: jest.fn(),
  createMaterial: jest.fn(),
  updateMaterial: jest.fn(),
  deleteMaterial: jest.fn(),
  listSheets: jest.fn(),
  createSheet: jest.fn(),
}));
const c = content as jest.Mocked<typeof content>;

const script = (over: Partial<Script> = {}): Script => ({
  steps: [
    { name: "Saludo", message: "Hola {nombre}", question: "¿Qué buscas?" },
    { name: "Precio", message: "Cuesta S/ 50", question: "" },
  ],
  version: 2,
  note: null,
  updatedAt: "2026-11-18T15:00:00.000Z",
  updatedByName: "Marta",
  myReadVersion: 2,
  ...over,
});
const mat = (over: Partial<Material> = {}): Material => ({
  id: "m1",
  sheetId: null,
  kind: "pdf",
  title: "Catálogo",
  url: "https://x.pe/catalogo.pdf",
  position: 0,
  ...over,
});
const sheet = (over: Partial<Sheet> = {}): Sheet => ({
  id: "s1",
  name: "Polo básico",
  price: "S/ 50",
  forWhom: "",
  highlights: "",
  alternatives: "",
  complements: "",
  active: true,
  materials: [],
  updatedAt: "2026-11-18T15:00:00.000Z",
  ...over,
});

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GuionView />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  c.getScript.mockResolvedValue(script());
  c.getScriptReads.mockResolvedValue({
    version: 2,
    items: [
      { userId: "u2", userName: "Ana", readVersion: 2, readAt: "2026-11-18T16:00:00.000Z", upToDate: true },
      { userId: "u3", userName: "Luis", readVersion: 1, readAt: null, upToDate: false },
    ],
  });
  c.listMaterials.mockResolvedValue([mat()]);
  c.listSheets.mockResolvedValue([sheet()]);
  c.updateMaterial.mockResolvedValue(mat());
  c.createMaterial.mockResolvedValue(mat());
  c.saveScript.mockResolvedValue(script({ version: 3 }));
});

describe("Guion y material", () => {
  it("muestra versión, quién y cuándo, y el texto de ayuda sobre Pau", async () => {
    setup();
    const v = await screen.findByTestId("guion-version");
    expect(v).toHaveTextContent("Versión 2");
    expect(v).toHaveTextContent("Marta");
    expect(screen.getByText(/Pau lee automáticamente este guion/)).toBeInTheDocument();
  });

  it("guardar pide confirmación y envía pasos y nota", async () => {
    setup();
    await screen.findByLabelText("Mensaje", { selector: "#gs-msg-0" });
    fireEvent.change(screen.getByLabelText("¿Qué cambió? (opcional)"), { target: { value: "Se ajustó el saludo" } });
    fireEvent.change(document.getElementById("gs-name-0") as HTMLInputElement, { target: { value: "Bienvenida" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva versión" }));
    expect(c.saveScript).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/verán un aviso/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar versión" }));
    await waitFor(() => expect(c.saveScript).toHaveBeenCalledTimes(1));
    expect(c.saveScript.mock.calls[0][0]).toEqual({
      steps: [
        { name: "Bienvenida", message: "Hola {nombre}", question: "¿Qué buscas?" },
        { name: "Precio", message: "Cuesta S/ 50", question: "" },
      ],
      note: "Se ajustó el saludo",
    });
  });

  it("reordenar: bajar el paso 1 cambia el orden que se envía", async () => {
    setup();
    await screen.findByRole("button", { name: "Bajar paso 1" });
    fireEvent.click(screen.getByRole("button", { name: "Bajar paso 1" }));
    const steps = screen.getAllByTestId("guion-step");
    expect(within(steps[0]).getByLabelText("Nombre del paso")).toHaveValue("Precio");
    expect(within(steps[1]).getByLabelText("Nombre del paso")).toHaveValue("Saludo");
    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva versión" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Guardar versión" }));
    await waitFor(() => expect(c.saveScript).toHaveBeenCalled());
    const sent = c.saveScript.mock.calls[0][0];
    expect(sent.steps.map((s) => s.name)).toEqual(["Precio", "Saludo"]);
    expect(sent).not.toHaveProperty("note");
  });

  it("el chip inserta {nombre} en el mensaje; añadir y quitar pasos", async () => {
    setup();
    await screen.findByRole("button", { name: "Añadir paso" });
    fireEvent.click(screen.getByRole("button", { name: "Añadir paso" }));
    expect(screen.getAllByTestId("guion-step")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Insertar nombre en el paso 3" }));
    expect(document.getElementById("gs-msg-2")).toHaveValue("{nombre}");
    fireEvent.click(screen.getByRole("button", { name: "Quitar paso 3" }));
    expect(screen.getAllByTestId("guion-step")).toHaveLength(2);
  });

  it("no deja guardar con un paso sin nombre o mensaje", async () => {
    setup();
    await screen.findByRole("button", { name: "Añadir paso" });
    fireEvent.click(screen.getByRole("button", { name: "Añadir paso" }));
    expect(screen.getByRole("button", { name: "Guardar nueva versión" })).toBeDisabled();
  });

  it("tabla «¿Leyeron el último guion?»", async () => {
    setup();
    const t = await screen.findByRole("table");
    expect(within(t).getByText("Ana")).toBeInTheDocument();
    expect(within(t).getByText("Al día")).toBeInTheDocument();
    expect(within(t).getByText("Pendiente")).toBeInTheDocument();
  });

  it("material del negocio: lista con enlace en pestaña nueva, añade (sin sheetId) y reordena", async () => {
    c.listMaterials.mockResolvedValue([mat(), mat({ id: "m2", title: "Pagos", kind: "link", position: 1, url: "https://x.pe/pagos" })]);
    setup();
    const list = await screen.findByRole("list", { name: "Material del negocio" });
    const link = within(list).getByRole("link", { name: "Abrir Catálogo" });
    expect(link).toHaveAttribute("href", "https://x.pe/catalogo.pdf");
    expect(link).toHaveAttribute("target", "_blank");

    fireEvent.change(screen.getAllByLabelText("Título del material")[0], { target: { value: "Política" } });
    fireEvent.change(screen.getAllByLabelText("Enlace del material")[0], { target: { value: "https://x.pe/politica" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" })[0]);
    await waitFor(() =>
      expect(c.createMaterial).toHaveBeenCalledWith({ kind: "link", title: "Política", url: "https://x.pe/politica" }),
    );

    fireEvent.click(within(list).getByRole("button", { name: "Bajar Catálogo" }));
    await waitFor(() => expect(c.updateMaterial).toHaveBeenCalledTimes(2));
    expect(c.updateMaterial).toHaveBeenCalledWith("m1", { position: 1 });
    expect(c.updateMaterial).toHaveBeenCalledWith("m2", { position: 0 });
  });

  it("no acepta un enlace que no sea http(s)", async () => {
    setup();
    await screen.findByRole("list", { name: "Material del negocio" });
    fireEvent.change(screen.getAllByLabelText("Título del material")[0], { target: { value: "Malo" } });
    fireEvent.change(screen.getAllByLabelText("Enlace del material")[0], { target: { value: "javascript:alert(1)" } });
    expect(screen.getAllByRole("button", { name: "Añadir" })[0]).toBeDisabled();
  });

  it("eliminar material pide confirmación", async () => {
    c.deleteMaterial.mockResolvedValue();
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Catálogo" }));
    expect(c.deleteMaterial).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(c.deleteMaterial).toHaveBeenCalledWith("m1"));
  });

  it("productos: lista con buscador, crea uno y muestra su material", async () => {
    c.createSheet.mockResolvedValue(sheet({ id: "s2", name: "Gorra" }));
    c.listSheets.mockResolvedValue([sheet({ materials: [mat({ id: "m9", sheetId: "s1", title: "Foto frontal", kind: "photo" })] })]);
    setup();
    expect(await screen.findByText("Polo básico")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar producto"), { target: { value: "polo" } });
    await waitFor(() => expect(c.listSheets).toHaveBeenCalledWith("polo"));

    fireEvent.click(await screen.findByRole("button", { name: /Material \(1\)/ }));
    expect(screen.getByRole("link", { name: "Abrir Foto frontal" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nuevo producto/ }));
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Gorra" } });
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "S/ 30" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    await waitFor(() =>
      expect(c.createSheet).toHaveBeenCalledWith({
        name: "Gorra",
        price: "S/ 30",
        forWhom: "",
        highlights: "",
        alternatives: "",
        complements: "",
      }),
    );
  });
});
