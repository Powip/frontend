import axiosAuth from "@/lib/axiosAuth";
import { createCall, deleteCall, getCallStats, listCalls } from "@/services/crmCallsService";
import { connectMetaAccount, deleteMetaAccount, listMetaAccounts } from "@/services/crmTeamService";
import { listConversations } from "@/services/crmService";

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
  http.delete.mockResolvedValue({ data: {} });
});

describe("crmCallsService", () => {
  it("listCalls manda days y mine, y conversationId solo si se pide", async () => {
    http.get.mockResolvedValue({ data: { items: [{ id: "k1" }] } });
    await expect(listCalls({ days: 7, mine: true })).resolves.toEqual([{ id: "k1" }]);
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/calls", { params: { days: 7, mine: true } });
    await listCalls({ days: 30, mine: false, conversationId: "c1" });
    expect(http.get.mock.calls[1][1]).toEqual({ params: { days: 30, mine: false, conversationId: "c1" } });
  });

  it("createCall hace POST con el cuerpo tal cual", async () => {
    http.post.mockResolvedValue({ data: { id: "k1" } });
    const input = {
      conversationId: "c1",
      direction: "out" as const,
      result: "callback" as const,
      callbackAt: "2026-11-20T15:00:00.000Z",
    };
    await expect(createCall(input)).resolves.toEqual({ id: "k1" });
    expect(http.post).toHaveBeenCalledWith("http://crm/crm/calls", input);
  });

  it("deleteCall y getCallStats usan sus rutas", async () => {
    await deleteCall("k 1");
    expect(http.delete).toHaveBeenCalledWith("http://crm/crm/calls/k%201");
    http.get.mockResolvedValue({ data: { calls: 3 } });
    await expect(getCallStats(1)).resolves.toEqual({ calls: 3 });
    expect(http.get).toHaveBeenLastCalledWith("http://crm/crm/calls/stats", { params: { days: 1 } });
  });
});

describe("cuentas de Messenger e Instagram", () => {
  it("listMetaAccounts devuelve data", async () => {
    http.get.mockResolvedValue({ data: { status: "success", data: [{ id: "a1" }] } });
    await expect(listMetaAccounts()).resolves.toEqual([{ id: "a1" }]);
    expect(http.get).toHaveBeenCalledWith("http://integrations/meta-messaging/accounts");
  });

  it("connectMetaAccount omite name vacío", async () => {
    http.post.mockResolvedValue({ data: { status: "success", data: { id: "a1" } } });
    await connectMetaAccount({ channel: "instagram", accountId: "1", pageId: "2", accessToken: "tok" });
    expect(http.post).toHaveBeenCalledWith("http://integrations/meta-messaging/accounts", {
      channel: "instagram",
      accountId: "1",
      pageId: "2",
      accessToken: "tok",
    });
    await connectMetaAccount({
      channel: "messenger",
      accountId: "1",
      pageId: "2",
      name: "N",
      accessToken: "tok",
    });
    expect(http.post.mock.calls[1][1]).toMatchObject({ name: "N" });
  });

  it("deleteMetaAccount hace DELETE por id", async () => {
    await deleteMetaAccount("a 1");
    expect(http.delete).toHaveBeenCalledWith("http://integrations/meta-messaging/accounts/a%201");
  });
});

describe("listConversations con canal", () => {
  it("envía channel solo si se filtra", async () => {
    await listConversations({ status: "open", assigned: "all" });
    expect(http.get.mock.calls[0][1]?.params).not.toHaveProperty("channel");
    await listConversations({ status: "open", assigned: "all", channel: "instagram" });
    expect(http.get.mock.calls[1][1]?.params).toMatchObject({ channel: "instagram" });
  });
});
