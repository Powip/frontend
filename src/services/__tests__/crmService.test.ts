import axios, { AxiosError } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  createPipeline,
  createStage,
  createTask,
  deletePipeline,
  deleteStage,
  deleteTask,
  getBoard,
  listPipelines,
  listTasks,
  renamePipeline,
  updateStage,
  updateTask,
  crmError,
  linkConversationOrder,
  listConversationOrders,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  updateConversation,
  cancelBroadcast,
  countAudience,
  createBroadcast,
  createFollowupRule,
  deleteBroadcast,
  deleteFollowupRule,
  getFollowupStats,
  listBroadcasts,
  listFollowupRules,
  listFollowupRuns,
  listTemplates,
  pauseBroadcast,
  resumeBroadcast,
  sendBroadcast,
  updateBroadcast,
  updateFollowupRule,
  createPauProvider,
  deletePauProvider,
  getPauSettings,
  getPauUsage,
  listPauProviders,
  pauSandbox,
  suggestPauReply,
  testPauProvider,
  updatePauProvider,
  updatePauSettings,
  PAU_TIMEOUT_MS,
} from "../crmService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const http = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockResolvedValue({ data: {} });
  http.post.mockResolvedValue({ data: {} });
  http.patch.mockResolvedValue({ data: {} });
  http.delete.mockResolvedValue({ data: {} });
});

describe("crmService", () => {
  it("listConversations manda filtros y omite search vacío", async () => {
    await listConversations({ status: "open", assigned: "me", search: "  " });
    expect(http.get).toHaveBeenCalledWith(
      "http://localhost:3012/crm/conversations",
      expect.objectContaining({
        params: { status: "open", assigned: "me", page: 1, limit: 30 },
      }),
    );
    await listConversations({ status: "closed", assigned: "all", search: " ana " });
    expect(http.get.mock.calls[1][1].params).toMatchObject({ search: "ana", status: "closed" });
  });

  it("listMessages usa before solo si se pide", async () => {
    await listMessages("c 1");
    expect(http.get).toHaveBeenLastCalledWith(
      "http://localhost:3012/crm/conversations/c%201/messages",
      { params: { limit: 50 } },
    );
    await listMessages("c1", { before: "2026-01-01T00:00:00Z" });
    expect(http.get.mock.calls[1][1].params).toEqual({ limit: 50, before: "2026-01-01T00:00:00Z" });
  });

  it("send, read y update llaman al endpoint correcto", async () => {
    await sendMessage("c1", "hola");
    expect(http.post).toHaveBeenCalledWith(
      "http://localhost:3012/crm/conversations/c1/messages",
      { body: "hola" },
    );
    await markConversationRead("c1");
    expect(http.post).toHaveBeenLastCalledWith("http://localhost:3012/crm/conversations/c1/read");
    await updateConversation("c1", { assignedUserId: null });
    expect(http.patch).toHaveBeenCalledWith(
      "http://localhost:3012/crm/conversations/c1",
      { assignedUserId: null },
    );
  });
});

describe("crmError", () => {
  it("lee code y message de la respuesta", () => {
    const err = new AxiosError("x", "ERR", undefined, undefined, {
      status: 409,
      data: { code: "WINDOW_CLOSED", message: "ventana cerrada" },
    } as never);
    expect(crmError(err)).toMatchObject({
      status: 409,
      code: "WINDOW_CLOSED",
      message: "ventana cerrada",
      unreachable: false,
    });
  });
  it("marca unreachable si no hay respuesta", () => {
    expect(axios.isAxiosError(new AxiosError("Network Error"))).toBe(true);
    expect(crmError(new AxiosError("Network Error")).unreachable).toBe(true);
  });

  it("listConversationOrders devuelve items", async () => {
    http.get.mockResolvedValue({ data: { items: [{ id: "l1" }] } });
    await expect(listConversationOrders("c 1")).resolves.toEqual([{ id: "l1" }]);
    expect(http.get).toHaveBeenCalledWith("http://localhost:3012/crm/conversations/c%201/orders");
  });

  it("linkConversationOrder hace POST con orderId y orderNumber", async () => {
    http.post.mockResolvedValue({ data: { id: "l1" } });
    await linkConversationOrder("c1", { orderId: "o1", orderNumber: "ORD-1" });
    expect(http.post).toHaveBeenCalledWith(
      "http://localhost:3012/crm/conversations/c1/orders",
      { orderId: "o1", orderNumber: "ORD-1" },
    );
  });

  it("updateConversation acepta clientId", async () => {
    await updateConversation("c1", { clientId: "cl1" });
    expect(http.patch).toHaveBeenCalledWith(
      "http://localhost:3012/crm/conversations/c1",
      { clientId: "cl1" },
    );
  });
});

describe("crmService · embudos y agenda", () => {
  const B = "http://localhost:3012/crm";

  it("embudos: lista, crea, renombra y elimina", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "p1" }] } });
    expect(await listPipelines()).toEqual([{ id: "p1" }]);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/pipelines`);
    await createPipeline("Mayoristas");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/pipelines`, { name: "Mayoristas" });
    await renamePipeline("p 1", "Nuevo");
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/pipelines/p%201`, { name: "Nuevo" });
    await deletePipeline("p1");
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/pipelines/p1`);
  });

  it("etapas: crea, actualiza y elimina devolviendo el embudo", async () => {
    await createStage("p1", { name: "Cotizado", color: "#fff", kind: "open" });
    expect(http.post).toHaveBeenLastCalledWith(`${B}/pipelines/p1/stages`, {
      name: "Cotizado",
      color: "#fff",
      kind: "open",
    });
    await updateStage("s1", { position: 2 });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/stages/s1`, { position: 2 });
    http.delete.mockResolvedValueOnce({ data: { id: "p1" } });
    expect(await deleteStage("s1")).toEqual({ id: "p1" });
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/stages/s1`);
  });

  it("getBoard manda el filtro de asignación", async () => {
    await getBoard("p1", "me");
    expect(http.get).toHaveBeenLastCalledWith(`${B}/pipelines/p1/board`, {
      params: { assigned: "me" },
    });
    await getBoard("p1");
    expect(http.get.mock.calls.at(-1)?.[1]).toEqual({ params: { assigned: "all" } });
  });

  it("tareas: lista con filtros, crea, edita y elimina", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "t1" }] } });
    expect(
      await listTasks({ assigned: "all", status: "pending", conversationId: "c1" }),
    ).toEqual([{ id: "t1" }]);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/tasks`, {
      params: { assigned: "all", status: "pending", conversationId: "c1" },
    });
    await listTasks({ assigned: "me", status: "done" });
    expect(http.get.mock.calls.at(-1)?.[1]).toEqual({ params: { assigned: "me", status: "done" } });
    const input = { type: "call" as const, title: "Llamar", dueAt: "2026-11-20T15:00:00.000Z" };
    await createTask(input);
    expect(http.post).toHaveBeenLastCalledWith(`${B}/tasks`, input);
    await updateTask("t1", { status: "done" });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/tasks/t1`, { status: "done" });
    await deleteTask("t1");
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/tasks/t1`);
  });

  it("updateConversation acepta stageId y lostReason", async () => {
    await updateConversation("c1", { stageId: "s9", lostReason: "Precio" });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/conversations/c1`, {
      stageId: "s9",
      lostReason: "Precio",
    });
  });
});

describe("crmService · plantillas y seguimientos", () => {
  const B = "http://localhost:3012/crm";

  it("listTemplates y listFollowupRules devuelven items", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ name: "t" }] } });
    expect(await listTemplates()).toEqual([{ name: "t" }]);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/templates`);
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "r1" }] } });
    expect(await listFollowupRules()).toEqual([{ id: "r1" }]);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/followup-rules`);
  });

  it("crea, edita y elimina reglas", async () => {
    const input = {
      name: "x",
      objective: "sale" as const,
      trigger: "customer_silent" as const,
      stageId: null,
      waitMinutes: 120,
      target: "customer" as const,
      message: "hola",
      templateName: null,
      templateLanguage: null,
      templateVariables: [],
    };
    await createFollowupRule(input);
    expect(http.post).toHaveBeenCalledWith(`${B}/followup-rules`, input);
    await updateFollowupRule("r 1", { active: true });
    expect(http.patch).toHaveBeenCalledWith(`${B}/followup-rules/r%201`, { active: true });
    await deleteFollowupRule("r1");
    expect(http.delete).toHaveBeenCalledWith(`${B}/followup-rules/r1`);
  });

  it("lee ejecuciones y estadísticas", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "u1" }] } });
    expect(await listFollowupRuns()).toEqual([{ id: "u1" }]);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/followup-rules/runs`);
    http.get.mockResolvedValueOnce({ data: { days: 30 } });
    expect(await getFollowupStats()).toEqual({ days: 30 });
    expect(http.get).toHaveBeenLastCalledWith(`${B}/followup-rules/stats`);
  });
});

describe("crmService · difusiones", () => {
  const B = "http://localhost:3012/crm/broadcasts";

  it("lista, crea, edita y elimina", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "b1" }] } });
    expect(await listBroadcasts()).toEqual([{ id: "b1" }]);
    expect(http.get).toHaveBeenLastCalledWith(B);
    const input = {
      name: "n",
      templateName: "t",
      templateLanguage: "es",
      audience: { type: "all" as const },
    };
    await createBroadcast(input);
    expect(http.post).toHaveBeenCalledWith(B, input);
    await updateBroadcast("b1", { name: "m" });
    expect(http.patch).toHaveBeenCalledWith(`${B}/b1`, { name: "m" });
    await deleteBroadcast("b1");
    expect(http.delete).toHaveBeenCalledWith(`${B}/b1`);
  });

  it("countAudience devuelve el número", async () => {
    http.post.mockResolvedValueOnce({ data: { count: 42 } });
    expect(await countAudience({ type: "stage", stageId: "s1" })).toBe(42);
    expect(http.post).toHaveBeenLastCalledWith(`${B}/audience/count`, {
      audience: { type: "stage", stageId: "s1" },
    });
  });

  it("send manda scheduledAt solo si se da; pause, resume y cancel hacen POST", async () => {
    await sendBroadcast("b1");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/b1/send`, {});
    await sendBroadcast("b1", "2026-11-20T15:00:00.000Z");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/b1/send`, { scheduledAt: "2026-11-20T15:00:00.000Z" });
    await pauseBroadcast("b1");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/b1/pause`);
    await resumeBroadcast("b1");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/b1/resume`);
    await cancelBroadcast("b1");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/b1/cancel`);
  });
});

describe("crmService · Pau", () => {
  const P = "http://localhost:3012/crm/pau";

  it("settings: GET y PATCH parcial (null quita el tope)", async () => {
    http.get.mockResolvedValueOnce({ data: { mode: "off" } });
    expect(await getPauSettings()).toEqual({ mode: "off" });
    expect(http.get).toHaveBeenCalledWith(`${P}/settings`);
    await updatePauSettings({ monthlyTokenCap: null });
    expect(http.patch).toHaveBeenCalledWith(`${P}/settings`, { monthlyTokenCap: null });
  });

  it("proveedores: lista, alta, edición, prueba y borrado", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "p1" }] } });
    expect(await listPauProviders()).toEqual([{ id: "p1" }]);
    expect(http.get).toHaveBeenCalledWith(`${P}/providers`);
    const input = { provider: "openai" as const, label: "Mi cuenta", apiKey: "k", model: "m" };
    await createPauProvider(input);
    expect(http.post).toHaveBeenCalledWith(`${P}/providers`, input);
    await updatePauProvider("p 1", { isDefault: true });
    expect(http.patch).toHaveBeenCalledWith(`${P}/providers/p%201`, { isDefault: true });
    http.post.mockResolvedValueOnce({ data: { ok: true, error: null, models: ["a"], provider: {} } });
    expect((await testPauProvider("p1")).models).toEqual(["a"]);
    expect(http.post).toHaveBeenLastCalledWith(`${P}/providers/p1/test`);
    await deletePauProvider("p1");
    expect(http.delete).toHaveBeenCalledWith(`${P}/providers/p1`);
  });

  it("consumo: GET /usage", async () => {
    await getPauUsage();
    expect(http.get).toHaveBeenCalledWith(`${P}/usage`);
  });

  it("sandbox manda el historial y usa timeout amplio", async () => {
    const turns = [{ role: "user" as const, text: "hola" }];
    await pauSandbox(turns);
    expect(http.post).toHaveBeenCalledWith(`${P}/sandbox`, { turns }, { timeout: PAU_TIMEOUT_MS });
    expect(PAU_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("suggest: POST con timeout amplio y devuelve el texto", async () => {
    http.post.mockResolvedValueOnce({ data: { text: "Hola Ana" } });
    expect(await suggestPauReply("c 1")).toEqual({ text: "Hola Ana" });
    expect(http.post).toHaveBeenLastCalledWith(
      "http://localhost:3012/crm/conversations/c%201/pau/suggest",
      undefined,
      { timeout: PAU_TIMEOUT_MS },
    );
  });

  it("crmError expone code y message de Pau", () => {
    const err = new AxiosError("x", "ERR", undefined, undefined, {
      status: 409,
      data: { code: "PAU_NO_PROVIDER", message: "Conecta un proveedor" },
    } as never);
    expect(crmError(err)).toMatchObject({ status: 409, code: "PAU_NO_PROVIDER", message: "Conecta un proveedor" });
  });
});
