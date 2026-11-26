import axiosAuth from "@/lib/axiosAuth";
import {
  countWhatsAppCampaignSegment,
  createWhatsAppCampaign,
  listWhatsAppCampaigns,
  previewWhatsAppRule,
  toCampaignBody,
  updateWhatsAppCampaign,
} from "../campaigns.api";
import type { CampaignValues } from "../../schemas/campaign.schema";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));

const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);
const put = jest.mocked(axiosAuth.put);

const dto = {
  id: "c-1",
  storeId: "s-1",
  name: "Recordatorio agencia",
  templateId: "tpl-1",
  templateName: "aviso_agencia",
  segment: { stage: "EN_AGENCIA", courierId: null, storeId: "s-1", destination: "lima" },
  segmentLabel: "texto del backend",
  schedule: { type: "recurring", date: null, recurrence: "daily", time: "09:00" },
  status: "scheduled",
  pausedReason: null,
  matchingToday: 4,
  results: null,
  version: 3,
};

const values: CampaignValues = {
  name: "  Recordatorio agencia ",
  templateId: "tpl-1",
  stage: "EN_AGENCIA",
  courierId: "all",
  storeId: "s-1",
  destination: "lima",
  scheduleType: "recurring",
  date: "2026-12-01",
  time: "09:00",
  recurrence: "daily",
} as CampaignValues;

beforeEach(() => jest.clearAllMocks());

describe("campaigns.api (C-21)", () => {
  it("lista y mapea los envíos de la tienda", async () => {
    get.mockResolvedValue({ data: { items: [dto], total: 1 } });
    const [campaign] = await listWhatsAppCampaigns("s-1");
    expect(get).toHaveBeenCalledWith("http://int/wa/campaigns", { params: { storeId: "s-1" } });
    expect(campaign).toMatchObject({
      id: "c-1",
      segment: { stage: "EN_AGENCIA", courierId: null, destination: "lima" },
      segmentLabel: null,
      schedule: { type: "recurring", recurrence: "daily", time: "09:00" },
      version: 3,
    });
  });

  it("arma el cuerpo: 'todos los couriers' es null y la recurrencia no lleva fecha", () => {
    expect(toCampaignBody(values)).toEqual({
      storeId: "s-1",
      name: "Recordatorio agencia",
      templateId: "tpl-1",
      segment: { stage: "EN_AGENCIA", courierId: null, storeId: "s-1", destination: "lima" },
      schedule: { type: "recurring", date: null, recurrence: "daily", time: "09:00", timezone: "America/Lima" },
    });
  });

  it("crea con Idempotency-Key y edita con If-Match", async () => {
    post.mockResolvedValue({ data: dto });
    put.mockResolvedValue({ data: dto });
    await createWhatsAppCampaign(values);
    expect(post.mock.calls[0][2]?.headers?.["Idempotency-Key"]).toBeTruthy();
    await updateWhatsAppCampaign("c-1", 3, values);
    expect(put.mock.calls[0][0]).toBe("http://int/wa/campaigns/c-1");
    expect(put.mock.calls[0][2]?.headers?.["If-Match"]).toBe("3");
  });

  it("pide conteo de segmento y vista previa de regla", async () => {
    post.mockResolvedValue({ data: { matchingToday: 7, computedAt: "2026-11-23T10:00:00.000Z" } });
    const count = await countWhatsAppCampaignSegment(values);
    expect(count.matchingToday).toBe(7);
    expect(count.computedAt).toBeInstanceOf(Date);
    const preview = await previewWhatsAppRule({ id: "r-1", key: "disponible_agencia" }, "s-1", "En agencia");
    expect(post).toHaveBeenLastCalledWith("http://int/wa/rules/r-1/preview", {
      ruleKey: "disponible_agencia",
      storeId: "s-1",
    });
    expect(preview).toMatchObject({ matchingOrders: 7, orderStateLabel: "En agencia", estimatedCost: null });
  });
});
