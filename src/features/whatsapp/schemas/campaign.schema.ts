import { z } from "zod";
import { WHATSAPP_SCHEDULING_LIMITS } from "../constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_CAMPAIGN_DESTINATIONS,
  WHATSAPP_CAMPAIGN_RECURRENCES,
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_NOTIFICATION_EVENTS,
} from "../enums/whatsapp.enums";
import { isLimaDateTimeInFuture, isValidDateKey, isValidTimeKey } from "../utils/lima-time.util";

export const CAMPAIGN_ALL_COURIERS = "all";

const campaignShape = z.object({
  name: z.string(),
  templateId: z.string(),
  stage: z.enum(WHATSAPP_NOTIFICATION_EVENTS),
  courierId: z.string(),
  storeId: z.string(),
  destination: z.enum(WHATSAPP_CAMPAIGN_DESTINATIONS),
  scheduleType: z.enum(WHATSAPP_CAMPAIGN_SCHEDULE_TYPES),
  date: z.string(),
  time: z.string(),
  recurrence: z.union([z.enum(WHATSAPP_CAMPAIGN_RECURRENCES), z.literal("")]),
});

export type CampaignValues = z.infer<typeof campaignShape>;

export function createCampaignSchema(now: () => Date = () => new Date()) {
  return campaignShape.superRefine((values, ctx) => {
    const addIssue = (path: keyof CampaignValues, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };
    const name = values.name.trim();
    if (!name) addIssue("name", "Escribe un nombre para el envío.");
    else if (name.length > WHATSAPP_SCHEDULING_LIMITS.campaignName) {
      addIssue("name", `Máximo ${WHATSAPP_SCHEDULING_LIMITS.campaignName} caracteres.`);
    }
    if (!values.templateId) addIssue("templateId", "Elige una plantilla aprobada.");
    if (!values.storeId) addIssue("storeId", "Elige una tienda.");
    if (!values.courierId) addIssue("courierId", "Elige un courier o «Todos».");
    if (!isValidTimeKey(values.time)) addIssue("time", "Elige una hora válida.");

    if (values.scheduleType === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE) {
      if (!isValidDateKey(values.date)) {
        addIssue("date", "Elige la fecha del envío.");
      } else if (
        isValidTimeKey(values.time) &&
        !isLimaDateTimeInFuture(values.date, values.time, now())
      ) {
        addIssue("date", "La fecha y hora deben ser posteriores a ahora (hora de Lima).");
      }
    } else if (!values.recurrence) {
      addIssue("recurrence", "Elige la frecuencia.");
    }
  });
}
