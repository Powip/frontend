import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DifusionesView from "@/components/ventas-chat/DifusionesView";
import * as svc from "@/services/crmService";
import type { Broadcast, Pipeline, Stage, Template } from "@/types/crm";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/difusiones",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
let mockRole = "ADMIN";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listBroadcasts: jest.fn(),
  listPipelines: jest.fn(),
  listTemplates: jest.fn(),
  createBroadcast: jest.fn(),
  updateBroadcast: jest.fn(),
  deleteBroadcast: jest.fn(),
  countAudience: jest.fn(),
  sendBroadcast: jest.fn(),
  pauseBroadcast: jest.fn(),
  resumeBroadcast: jest.fn(),
  cancelBroadcast: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

const stage = (id: string, name: string, position: number): Stage => ({
  id,
  pipelineId: "p1",
  name,
  color: "#22c55e",
  position,
  kind: "open",
});
const pipeline: Pipeline = {
  id: "p1",
  name: "Ventas",
  isDefault: true,
  stages: [stage("s1", "Nuevo", 0), stage("s2", "Cotizado", 1)],
};

const bc = (over: Partial<Broadcast> = {}): Broadcast => ({
  id: "b1",
  name: "Nueva colección",
  templateName: "novedades",
  templateLanguage: "es",
  templateVariables: ["{nombre}"],
  audience: { type: "stage", stageId: "s2" },
  status: "sending",
  scheduledAt: null,
  startedAt: "2026-11-19T15:00:00.000Z",
  finishedAt: null,
  total: 200,
  sentCount: 80,
  failedCount: 4,
  deliveredCount: 60,
  readCount: 30,
  createdByName: "Jairo",
  createdAt: "2026-11-19T14:00:00.000Z",
  ...over,
});

const TEMPLATES: Template[] = [
  {
    name: "novedades",
    language: "es",
    category: "MARKETING",
    status: "APPROVED",
    bodyText: "Hola {{1}}, llegó lo nuevo.",
    variableCount: 1,
  },
  {
    name: "pendiente",
    language: "es",
    category: "UTILITY",
    status: "PENDING",
    bodyText: "No debe poder elegirse",
    variableCount: 0,
  },
];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <DifusionesView />
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  s.listBroadcasts.mockResolvedValue([
    { ...bc(), replies: 12, sales: 3, salesAmount: 459 } as Broadcast,
    bc({ id: "b2", name: "Borrador de prueba", status: "draft", total: 0, sentCount: 0, failedCount: 0, deliveredCount: 0, readCount: 0 }),
  ]);
  s.listPipelines.mockResolvedValue([pipeline]);
  s.listTemplates.mockResolvedValue(TEMPLATES);
  s.countAudience.mockResolvedValue(150);
  s.createBroadcast.mockResolvedValue(bc({ id: "n1", status: "draft" }));
  s.sendBroadcast.mockResolvedValue(bc({ id: "n1" }));
  s.pauseBroadcast.mockResolvedValue(bc({ status: "paused" }));
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("Difusiones · lista", () => {
  it("muestra estado, plantilla, público y progreso", async () => {
    setup();
    const rows = await screen.findAllByTestId("broadcast-row");
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText("Enviando")).toBeInTheDocument();
    expect(first.getByText(/Plantilla novedades/)).toBeInTheDocument();
    expect(first.getByText(/Etapa «Cotizado»/)).toBeInTheDocument();
    expect(first.getByText("80")).toBeInTheDocument();
    expect(first.getByText("200")).toBeInTheDocument();
    expect(first.getByTestId("bc-delivered")).toHaveTextContent("60");
    expect(first.getByTestId("bc-read")).toHaveTextContent("30");
    expect(first.getByTestId("bc-replies")).toHaveTextContent("12");
    expect(first.getByTestId("bc-sales")).toHaveTextContent(/^3 · S\/\s?459/);
    expect(first.getByText(/fallidos/).textContent).toContain("4");
    expect(first.getByRole("progressbar", { name: "Progreso de Nueva colección" })).toBeInTheDocument();
    const second = within(rows[1]);
    expect(second.getByText("Borrador")).toBeInTheDocument();
    expect(second.getByRole("button", { name: /Continuar/ })).toBeInTheDocument();
    expect(second.getByTestId("bc-sales")).toHaveTextContent("—");
    expect(second.getByRole("button", { name: /Enviar/ })).toBeInTheDocument();
    expect(second.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("pausar llama al servicio", async () => {
    setup();
    const row = (await screen.findAllByTestId("broadcast-row"))[0];
    fireEvent.click(within(row).getByRole("button", { name: /Pausar/ }));
    await waitFor(() => expect(s.pauseBroadcast).toHaveBeenCalledWith("b1"));
  });

  it("cancelar pide confirmación", async () => {
    s.cancelBroadcast.mockResolvedValue(bc({ status: "cancelled" }));
    setup();
    const row = (await screen.findAllByTestId("broadcast-row"))[0];
    fireEvent.click(within(row).getByRole("button", { name: /Cancelar/ }));
    expect(s.cancelBroadcast).not.toHaveBeenCalled();
    const dlg = await screen.findByRole("alertdialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Sí, cancelar" }));
    await waitFor(() => expect(s.cancelBroadcast).toHaveBeenCalledWith("b1"));
  });

  it("enviar un borrador pide confirmación diciendo a cuántas personas", async () => {
    s.sendBroadcast.mockResolvedValue(bc({ id: "b2", status: "sending" }));
    setup();
    const row = (await screen.findAllByTestId("broadcast-row"))[1];
    fireEvent.click(within(row).getByRole("button", { name: /Enviar/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(await within(dlg).findByText(/a 150 personas ahora/)).toBeInTheDocument();
    expect(s.sendBroadcast).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Sí, enviar" }));
    await waitFor(() => expect(s.sendBroadcast).toHaveBeenCalledWith("b2", undefined));
  });

  it("el evento en vivo actualiza el progreso (caché)", async () => {
    const { qc } = setup();
    await screen.findAllByTestId("broadcast-row");
    const { applyCrmEvent } = await import("@/lib/crmSse");
    React.act(() => {
      applyCrmEvent(qc, {
        type: "broadcast.updated",
        data: { broadcast: bc({ sentCount: 150, readCount: 90 }) },
      });
    });
    const first = within((await screen.findAllByTestId("broadcast-row"))[0]);
    await waitFor(() => expect(first.getByText("150")).toBeInTheDocument());
  });
});

describe("Difusiones · vendedora (R4)", () => {
  it("ve resultados pero no crea ni maneja difusiones", async () => {
    mockRole = "SELLER";
    setup();
    const rows = await screen.findAllByTestId("broadcast-row");
    expect(rows).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Nueva difusión/ })).not.toBeInTheDocument();
    expect(screen.getByText("Solo el administrador crea difusiones")).toBeInTheDocument();
    expect(within(rows[0]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[1]).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Difusiones · nueva difusión", () => {
  const open = async () => {
    const utils = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva difusión/ }));
    const dlg = within(await screen.findByRole("dialog"));
    await waitFor(() =>
      expect(within(dlg.getByLabelText("Plantilla")).getAllByRole("option").length).toBeGreaterThan(1),
    );
    return { dlg, ...utils };
  };

  const fill = async (dlg: ReturnType<typeof within>) => {
    fireEvent.change(dlg.getByLabelText("Nombre de la difusión"), { target: { value: "Noviembre" } });
    expect(within(dlg.getByLabelText("Plantilla")).queryByText(/pendiente/)).not.toBeInTheDocument();
    fireEvent.change(dlg.getByLabelText("Plantilla"), { target: { value: "novedades|es" } });
    fireEvent.change(dlg.getByLabelText("Valor de {{1}}"), { target: { value: "{nombre}" } });
    fireEvent.change(dlg.getByLabelText("Tipo de público"), { target: { value: "inactive" } });
    fireEvent.change(dlg.getByLabelText(/Sin escribir hace/), { target: { value: "45" } });
    await waitFor(() =>
      expect(dlg.getByTestId("audience-count")).toHaveTextContent("Llegará a 150 personas"),
    );
  };

  it("guarda un borrador con el payload correcto y muestra costo estimado", async () => {
    const { dlg } = await open();
    await fill(dlg);
    expect(s.countAudience).toHaveBeenLastCalledWith({ type: "inactive", inactiveDays: 45 });
    expect(dlg.getByTestId("cost-estimate")).toHaveTextContent("≈ S/ 45.00");
    expect(dlg.getByText(/aproximado/)).toBeInTheDocument();
    expect(dlg.getByText(/lo cobra|hace Meta/)).toBeInTheDocument();
    fireEvent.click(dlg.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() =>
      expect(s.createBroadcast).toHaveBeenCalledWith({
        name: "Noviembre",
        templateName: "novedades",
        templateLanguage: "es",
        templateVariables: ["{nombre}"],
        audience: { type: "inactive", inactiveDays: 45 },
      }),
    );
    expect(s.sendBroadcast).not.toHaveBeenCalled();
  });

  it("«Enviar ahora» pide confirmar con el conteo antes de crear y enviar", async () => {
    const { dlg } = await open();
    await fill(dlg);
    fireEvent.click(dlg.getByRole("button", { name: "Enviar ahora" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/a 150 personas ahora/)).toBeInTheDocument();
    expect(s.createBroadcast).not.toHaveBeenCalled();
    expect(s.sendBroadcast).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Sí, enviar" }));
    await waitFor(() => expect(s.sendBroadcast).toHaveBeenCalledWith("n1", undefined));
    expect(s.createBroadcast).toHaveBeenCalledTimes(1);
  });

  it("programar manda scheduledAt en ISO desde hora Lima", async () => {
    const { dlg } = await open();
    await fill(dlg);
    fireEvent.click(dlg.getByLabelText("Programar para otra fecha y hora"));
    fireEvent.change(dlg.getByLabelText("Fecha y hora (Lima)"), {
      target: { value: "2099-01-05T09:30" },
    });
    fireEvent.click(dlg.getByRole("button", { name: "Programar" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Sí, programar" }));
    await waitFor(() =>
      expect(s.sendBroadcast).toHaveBeenCalledWith("n1", "2099-01-05T14:30:00.000Z"),
    );
  });

  it("sin plantillas aprobadas avisa que se necesita una aprobada por Meta", async () => {
    s.listTemplates.mockResolvedValue([TEMPLATES[1]]);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva difusión/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(await dlg.findByText(/Necesitas una plantilla aprobada/)).toBeInTheDocument();
    expect(dlg.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    expect(dlg.getByRole("button", { name: "Enviar ahora" })).toBeDisabled();
  });

  it("público vacío no deja enviar", async () => {
    s.countAudience.mockResolvedValue(0);
    const { dlg } = await open();
    fireEvent.change(dlg.getByLabelText("Nombre de la difusión"), { target: { value: "X" } });
    fireEvent.change(dlg.getByLabelText("Plantilla"), { target: { value: "novedades|es" } });
    fireEvent.change(dlg.getByLabelText("Valor de {{1}}"), { target: { value: "{nombre}" } });
    await waitFor(() => expect(dlg.getByTestId("audience-count")).toHaveTextContent("Llegará a 0 personas"));
    expect(dlg.getByRole("button", { name: "Enviar ahora" })).toBeDisabled();
    expect(dlg.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
  });
});
