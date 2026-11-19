import { AxiosError } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import * as crmService from "@/services/crmService";
import {
  connectCustomWaba,
  getAudit,
  getCrmSettings,
  getTeamStats,
  integrationsErrorMessage,
  listTeamMembers,
  reassignConversation,
  remindScript,
  updateCrmSettings,
} from "@/services/crmTeamService";

jest.mock("@/lib/api", () => ({
  API: { crm: "http://crm", integrations: "http://integrations" },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  updateConversation: jest.fn(),
}));

const http = axiosAuth as jest.Mocked<typeof axiosAuth>;

beforeEach(() => jest.clearAllMocks());

describe("crmTeamService", () => {
  it("getTeamStats pide /crm/team/stats con days", async () => {
    http.get.mockResolvedValue({ data: { days: 30 } });
    await expect(getTeamStats(30)).resolves.toEqual({ days: 30 });
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/team/stats", { params: { days: 30 } });
  });

  it("listTeamMembers devuelve items", async () => {
    http.get.mockResolvedValue({ data: { items: [{ userId: "u1", userName: "Ana" }] } });
    await expect(listTeamMembers()).resolves.toEqual([{ userId: "u1", userName: "Ana" }]);
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/team/members");
  });

  it("reassignConversation llama updateConversation con id y nombre", async () => {
    (crmService.updateConversation as jest.Mock).mockResolvedValue({ id: "c1" });
    await reassignConversation("c1", { userId: "u2", userName: "Luis" });
    expect(crmService.updateConversation).toHaveBeenCalledWith("c1", {
      assignedUserId: "u2",
      assignedUserName: "Luis",
    });
  });

  it("getAudit y remindScript usan sus rutas", async () => {
    http.get.mockResolvedValue({ data: { score: 80 } });
    await getAudit();
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/audit");
    http.post.mockResolvedValue({ data: { ok: true } });
    await expect(remindScript({ userId: "u1", userName: "Ana" })).resolves.toEqual({ ok: true });
    expect(http.post).toHaveBeenCalledWith("http://crm/crm/content/script/remind", {
      userId: "u1",
      userName: "Ana",
    });
  });

  it("getCrmSettings y updateCrmSettings (parcial)", async () => {
    http.get.mockResolvedValue({ data: { slaMinutes: 15 } });
    await getCrmSettings();
    expect(http.get).toHaveBeenCalledWith("http://crm/crm/settings");
    http.patch.mockResolvedValue({ data: { slaMinutes: 20 } });
    await expect(updateCrmSettings({ slaMinutes: 20 })).resolves.toEqual({ slaMinutes: 20 });
    expect(http.patch).toHaveBeenCalledWith("http://crm/crm/settings", { slaMinutes: 20 });
  });

  it("connectCustomWaba envía solo los 4 campos a ms-integrations", async () => {
    http.post.mockResolvedValue({ data: { status: "success" } });
    await connectCustomWaba({
      wabaId: "w1",
      phoneNumberId: "p1",
      businessPhoneNumber: "+51999999999",
      accessToken: "tok",
      // @ts-expect-error campo ajeno: no debe viajar
      extra: "x",
    });
    expect(http.post).toHaveBeenCalledWith(
      "http://integrations/whatsapp/onboarding/connect-custom-waba",
      {
        wabaId: "w1",
        phoneNumberId: "p1",
        businessPhoneNumber: "+51999999999",
        accessToken: "tok",
      },
    );
  });
});

describe("integrationsErrorMessage", () => {
  const axiosErr = (status: number | null, data?: unknown) => {
    const e = new AxiosError("Request failed");
    if (status) {
      e.response = { status, data, statusText: "", headers: {}, config: {} as never };
    }
    return e;
  };

  it("junta los errores de validación con su campo", () => {
    const msg = integrationsErrorMessage(
      axiosErr(400, {
        message: "Validation failed",
        errors: [{ field: "wabaId", message: "WABA ID is required" }],
      }),
    );
    expect(msg).toBe("wabaId: WABA ID is required");
  });

  it("usa el message de 422/502", () => {
    expect(integrationsErrorMessage(axiosErr(422, { message: "Token inválido" }))).toBe(
      "Token inválido",
    );
  });

  it("sin respuesta avisa que no hay conexión", () => {
    expect(integrationsErrorMessage(axiosErr(null))).toMatch(/No se pudo conectar/);
  });
});
