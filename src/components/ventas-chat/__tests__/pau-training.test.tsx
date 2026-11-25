import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PauTrainingSection } from "../PauTrainingSection";
import {
  activatePauTraining,
  compilePauTraining,
  examPauTraining,
  getPauTrainings,
  type PauTrainingOverview,
  type PauTrainingVersion,
} from "@/services/crmTrainingService";

jest.mock("@/services/crmTrainingService", () => ({
  getPauTrainings: jest.fn(),
  compilePauTraining: jest.fn(async () => ({})),
  examPauTraining: jest.fn(async () => ({})),
  activatePauTraining: jest.fn(async () => ({})),
  deactivatePauTraining: jest.fn(async () => undefined),
  getPauTrainingContent: jest.fn(async () => ({ version: 1, content: "Metodología…" })),
  downloadPauTrainingDataset: jest.fn(async () => undefined),
}));
jest.mock("@/services/crmService", () => ({ crmError: (e: Error) => ({ message: e.message }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const version = (over: Partial<PauTrainingVersion>): PauTrainingVersion => ({
  id: "t1",
  version: 1,
  status: "draft",
  methodologyVersion: "metodologia-maestra-v1",
  contentHash: "h",
  sources: { sheets: 2, objections: 3, scriptSteps: 4, materials: 1, policies: 1, photos: 1 },
  exam: null,
  createdByName: "admin@local",
  createdAt: "2026-11-24T10:00:00.000Z",
  examinedAt: null,
  activatedAt: null,
  ...over,
});

const overview = (items: PauTrainingVersion[], over: Partial<PauTrainingOverview> = {}): PauTrainingOverview => ({
  methodology: {
    version: "metodologia-maestra-v1",
    title: "Metodología Maestra",
    file: "m.pdf",
    date: "2026-11-23",
    pages: 22,
    sha256: "x",
  },
  active: items.find((i) => i.status === "active") ?? null,
  outdated: false,
  examCases: [],
  items,
  ...over,
});

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PauTrainingSection />
    </QueryClientProvider>,
  );

describe("PauTrainingSection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin versiones explica que rige la metodología base y deja compilar", async () => {
    (getPauTrainings as jest.Mock).mockResolvedValue(overview([]));
    renderIt();
    expect(await screen.findByText(/Pau usa la metodología base/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Compilar versión/ }));
    await waitFor(() => expect(compilePauTraining).toHaveBeenCalled());
  });

  it("una versión sin examinar se examina; no se puede activar", async () => {
    (getPauTrainings as jest.Mock).mockResolvedValue(overview([version({})]));
    renderIt();
    expect(await screen.findByText("Sin examinar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Rendir examen/ }));
    await waitFor(() => expect(examPauTraining).toHaveBeenCalledWith("t1"));
  });

  it("una versión aprobada muestra el examen y se activa", async () => {
    const exam = {
      passed: true,
      critical: { total: 1, failed: 0 },
      style: { total: 2, passed: 2, rate: 1 },
      cases: [
        {
          caseId: "humano",
          title: "Pide hablar con una persona",
          answer: "Te paso con una asesora.",
          toolCalls: ["pedir_ayuda_humana"],
          checks: [{ check: "handoff" as const, pass: true }],
          pass: true,
        },
      ],
      ranAt: "2026-11-24T10:00:00.000Z",
      model: "modelo-local",
    };
    (getPauTrainings as jest.Mock).mockResolvedValue(overview([version({ status: "passed", exam })]));
    renderIt();
    expect(await screen.findByText("Aprobada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver examen" }));
    expect(screen.getByTestId("exam-result")).toHaveTextContent("Pasa a una persona");
    expect(screen.getByTestId("exam-result")).toHaveTextContent("Modelo: modelo-local");
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(activatePauTraining).toHaveBeenCalledWith("t1"));
  });

  it("un caso que falló por el proveedor sale «No se pudo evaluar» con el motivo, y el guion base se nombra", async () => {
    const exam = {
      passed: false,
      critical: { total: 1, failed: 0 },
      unevaluated: 1,
      style: { total: 0, passed: 0, rate: 1 },
      cases: [
        { caseId: "precio", title: "Pregunta el precio", answer: "", toolCalls: [], checks: [], pass: false, error: "timeout de 60 s" },
      ],
      ranAt: "2026-11-25T10:00:00.000Z",
      model: null,
    };
    (getPauTrainings as jest.Mock).mockResolvedValue(
      overview([
        version({
          status: "failed",
          exam,
          sources: { sheets: 2, objections: 3, scriptSteps: 6, scriptSource: "methodology", storeScripts: 1, materials: 1, policies: 1, photos: 1 },
        }),
      ]),
    );
    renderIt();
    expect(await screen.findByText(/6 pasos de guion/)).toHaveTextContent("(guion base)");
    expect(screen.getByText(/1 tienda con guion propio/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver examen" }));
    expect(screen.getByTestId("exam-unevaluated")).toHaveTextContent("1 caso no se pudo evaluar");
    expect(screen.getByTestId("case-unevaluated")).toHaveTextContent("No se pudo evaluar: timeout de 60 s");
  });

  it("avisa si el contenido cambió desde la versión activa", async () => {
    (getPauTrainings as jest.Mock).mockResolvedValue(
      overview([version({ status: "active" })], { outdated: true }),
    );
    renderIt();
    expect(await screen.findByText(/Tu contenido cambió/)).toBeInTheDocument();
    expect(screen.getByText(/Pau usa la versión 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a la metodología base" })).toBeInTheDocument();
  });
});
