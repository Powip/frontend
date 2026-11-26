import axiosAuth from "@/lib/axiosAuth";
import {
  getInboxSummary,
  listConversationFollowups,
  listConversations,
  listTags,
  sendConversationTemplate,
  sendNote,
  updateConversation,
} from "@/services/crmService";
import { proposeObjection } from "@/services/crmContentService";

jest.mock("@/lib/api", () => ({
  API: { crm: "http://crm", integrations: "http://integrations" },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const http = axiosAuth as jest.Mocked<typeof axiosAuth>;

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockResolvedValue({ data: {} });
  http.post.mockResolvedValue({ data: {} });
  http.patch.mockResolvedValue({ data: {} });
});

describe("crmService · Bandeja", () => {
  it("getInboxSummary hace GET a /crm/inbox/summary", async () => {
    const data = { slaMinutes: 15, open: 3, unanswered: 1, overSla: 0, mineUnanswered: 1, unassigned: 2, pauHelp: 0, thinking: 0 };
    http.get.mockResolvedValue({ data });
    await expect(getInboxSummary()).resolves.toEqual(data);
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/inbox/summary");
  });

  it("listConversations envía los indicadores y la etiqueta solo cuando se piden", async () => {
    http.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 30 } });
    await listConversations({ status: "open", assigned: "all" });
    expect(http.get.mock.calls[0][1]?.params).toEqual({ status: "open", assigned: "all", page: 1, limit: 30 });

    await listConversations({
      status: "open",
      assigned: "all",
      unanswered: true,
      overSla: true,
      pauHelp: true,
      thinking: true,
      tag: " VIP ",
    });
    expect(http.get.mock.calls[1][1]?.params).toEqual({
      status: "open",
      assigned: "all",
      page: 1,
      limit: 30,
      unanswered: "true",
      overSla: "true",
      pauHelp: "true",
      thinking: "true",
      tag: "VIP",
    });

    await listConversations({ status: "open", assigned: "all", unanswered: false, tag: "  " });
    expect(http.get.mock.calls[2][1]?.params).toEqual({ status: "open", assigned: "all", page: 1, limit: 30 });
  });

  it("sendNote hace POST a notes con el cuerpo", async () => {
    http.post.mockResolvedValue({ data: { id: "n1", type: "note" } });
    await expect(sendNote("c 1", "Llamar")).resolves.toEqual({ id: "n1", type: "note" });
    expect(http.post).toHaveBeenCalledWith("http://crm/crm/conversations/c%201/notes", { body: "Llamar" });
  });

  it("sendConversationTemplate hace POST a template con nombre, idioma y variables", async () => {
    const input = { templateName: "retomar", templateLanguage: "es", variables: ["Ana", "ORD-1"] };
    await sendConversationTemplate("c1", input);
    expect(http.post).toHaveBeenCalledWith("http://crm/crm/conversations/c1/template", input);
  });

  it("listTags y listConversationFollowups devuelven items", async () => {
    http.get.mockResolvedValueOnce({ data: { items: ["VIP"] } });
    await expect(listTags()).resolves.toEqual(["VIP"]);
    expect(http.get).toHaveBeenLastCalledWith("http://crm/crm/tags");
    http.get.mockResolvedValueOnce({ data: { items: [{ ruleId: "r1" }] } });
    await expect(listConversationFollowups("c1")).resolves.toEqual([{ ruleId: "r1" }]);
    expect(http.get).toHaveBeenLastCalledWith("http://crm/crm/conversations/c1/followups");
  });

  it("updateConversation acepta resumeAt y tags", async () => {
    await updateConversation("c1", { resumeAt: "2026-11-20T14:00:00.000Z", resumeNote: "x", tags: ["VIP"] });
    expect(http.patch).toHaveBeenCalledWith("http://crm/crm/conversations/c1", {
      resumeAt: "2026-11-20T14:00:00.000Z",
      resumeNote: "x",
      tags: ["VIP"],
    });
    await updateConversation("c1", { resumeAt: null });
    expect(http.patch).toHaveBeenLastCalledWith("http://crm/crm/conversations/c1", { resumeAt: null });
  });

  it("proposeObjection hace POST a content/objections/propose", async () => {
    http.post.mockResolvedValue({ data: { id: "o1", active: false } });
    await expect(proposeObjection({ name: "¿Envíos?", response: "Sí" })).resolves.toEqual({ id: "o1", active: false });
    expect(http.post).toHaveBeenCalledWith("http://crm/crm/content/objections/propose", {
      name: "¿Envíos?",
      response: "Sí",
    });
  });
});
