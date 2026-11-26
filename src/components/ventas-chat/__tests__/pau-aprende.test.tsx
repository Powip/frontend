import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PauAprende } from "../PauAprende";
import {
  approvePauLearning,
  discardPauLearning,
  getPauLearning,
  uploadPauDocument,
  type PauLearningOverview,
} from "@/services/crmPauLearningService";

jest.mock("@/services/crmPauLearningService", () => ({
  PAU_DOC_ACCEPT: ".pdf,.docx,.xlsx,.txt,.csv",
  PAU_DOC_MAX_BYTES: 10 * 1024 * 1024,
  getPauLearning: jest.fn(),
  uploadPauDocument: jest.fn(async () => ({})),
  removePauDocument: jest.fn(async () => undefined),
  approvePauLearning: jest.fn(async () => undefined),
  discardPauLearning: jest.fn(async () => undefined),
}));
jest.mock("@/services/crmService", () => ({ crmError: (e: Error) => ({ message: e.message }) }));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({ stores: [{ id: "st-1", name: "KUNCA" }], isAdmin: true, level: "admin" }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const data: PauLearningOverview = {
  pending: [
    {
      id: "o1",
      source: "objection",
      type: "Objeción",
      storeId: null,
      origin: "Pau detectó",
      question: "Lo vi más barato",
      answer: "Somos originales con garantía",
      createdAt: "2026-11-24T10:00:00.000Z",
    },
    {
      id: "l1",
      source: "learning",
      type: "Pregunta sin respuesta",
      storeId: "st-1",
      origin: "Pau detectó",
      question: "¿Se lava en lavadora?",
      answer: null,
      createdAt: "2026-11-24T09:00:00.000Z",
    },
  ],
  documents: [
    { id: "d1", name: "Política de cambios", storeId: "st-1", status: "processing", error: null, pending: 0, approved: 0, createdAt: "2026-11-24T08:00:00.000Z" },
    { id: "d2", name: "Tallas", storeId: null, status: "learned", error: null, pending: 0, approved: 3, createdAt: "2026-11-20T08:00:00.000Z" },
  ],
  learned: [{ question: "¿Hacen cambios?", answer: "Sí, 7 días", storeId: null, by: "ana@x.pe", at: "2026-11-23T08:00:00.000Z" }],
};

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PauAprende />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (getPauLearning as jest.Mock).mockResolvedValue(data);
});

describe("Pau → Aprende (mockup 152, P10)", () => {
  it("muestra por aprobar, documentos con su estado y ya aprendido", async () => {
    renderIt();
    expect(await screen.findByText("2 pendientes")).toBeInTheDocument();
    const [objection, question] = screen.getAllByTestId("pau-pending");
    expect(within(objection).getByText("Objeción")).toBeInTheDocument();
    expect(within(objection).getByText("Somos originales con garantía")).toBeInTheDocument();
    expect(within(question).getByText("No hay respuesta oficial. Escríbela para que Pau la use.")).toBeInTheDocument();
    expect(within(question).getByText("KUNCA · Pau detectó")).toBeInTheDocument();
    expect(within(question).getByRole("button", { name: "Aprobar" })).toBeDisabled();
    const docs = screen.getAllByTestId("pau-doc");
    expect(within(docs[0]).getByText("Procesando")).toBeInTheDocument();
    expect(within(docs[1]).getByText("Aprendido")).toBeInTheDocument();
    expect(screen.getByText(/Sí, 7 días · aprobó ana@x.pe/)).toBeInTheDocument();
  });

  it("aprobar y descartar mandan el origen correcto", async () => {
    renderIt();
    const [objection] = await screen.findAllByTestId("pau-pending");
    fireEvent.click(within(objection).getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(approvePauLearning).toHaveBeenCalledWith({ source: "objection", id: "o1" }, expect.anything()));
    fireEvent.click(within(objection).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(discardPauLearning).toHaveBeenCalledWith({ source: "objection", id: "o1" }, expect.anything()));
  });

  it("responder una pregunta sin respuesta la aprueba con la respuesta oficial", async () => {
    renderIt();
    const [, question] = await screen.findAllByTestId("pau-pending");
    fireEvent.click(within(question).getByRole("button", { name: "Responder" }));
    const save = await screen.findByRole("button", { name: "Guardar y aprobar" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lo que Pau responderá"), { target: { value: "Sí, en agua fría." } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(approvePauLearning).toHaveBeenCalledWith({ source: "learning", id: "l1", answer: "Sí, en agua fría." }, expect.anything()),
    );
  });

  it("subir documento: elige archivo, nombre y tienda", async () => {
    renderIt();
    fireEvent.click(await screen.findByRole("button", { name: "Subir" }));
    expect(await screen.findByText("Elegir PDF, Word o Excel")).toBeInTheDocument();
    const file = new File(["Cambios hasta 7 días"], "politica.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Archivo del documento"), { target: { files: [file] } });
    expect(screen.getByLabelText("Nombre")).toHaveValue("politica");
    fireEvent.change(screen.getByLabelText("Tienda"), { target: { value: "st-1" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Subir" }));
    await waitFor(() =>
      expect(uploadPauDocument).toHaveBeenCalledWith({ file, name: "politica", storeId: "st-1" }, expect.anything()),
    );
  });

  it("sin pendientes muestra «Todo revisado»", async () => {
    (getPauLearning as jest.Mock).mockResolvedValue({ pending: [], documents: [], learned: [] });
    renderIt();
    expect(await screen.findByText("Todo revisado")).toBeInTheDocument();
  });
});
