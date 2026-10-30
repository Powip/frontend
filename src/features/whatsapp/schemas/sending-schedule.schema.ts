import { z } from "zod";
import { WHATSAPP_SCHEDULING_LIMITS } from "../constants/whatsapp-scheduling-catalog";
import { WHATSAPP_OUT_OF_HOURS_POLICIES, WHATSAPP_WEEKDAYS } from "../enums/whatsapp.enums";
import { isValidTimeKey } from "../utils/lima-time.util";
import { parseIntegerInRange } from "./rule-config.schema";

export const sendingScheduleSchema = z
  .object({
    days: z.array(z.enum(WHATSAPP_WEEKDAYS)),
    from: z.string(),
    to: z.string(),
    outOfHours: z.enum(WHATSAPP_OUT_OF_HOURS_POLICIES),
    dedupe: z.boolean(),
    maxPerOrderPerDay: z.string(),
  })
  .superRefine((values, ctx) => {
    const addIssue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (values.days.length === 0) addIssue("days", "Elige al menos un día.");
    const fromValid = isValidTimeKey(values.from);
    const toValid = isValidTimeKey(values.to);
    if (!fromValid) addIssue("from", "Elige una hora válida.");
    if (!toValid) addIssue("to", "Elige una hora válida.");
    if (fromValid && toValid) {
      if (values.from === values.to) {
        addIssue("to", "La hora final debe ser distinta de la inicial.");
      } else if (values.to < values.from) {
        addIssue(
          "to",
          "El horario no puede cruzar la medianoche. Usa un rango dentro del mismo día.",
        );
      }
    }
    const { min, max } = WHATSAPP_SCHEDULING_LIMITS.maxPerOrderPerDay;
    if (parseIntegerInRange(values.maxPerOrderPerDay, min, max) === null) {
      addIssue("maxPerOrderPerDay", `Escribe un número entero entre ${min} y ${max}.`);
    }
  });

export type SendingScheduleValues = z.infer<typeof sendingScheduleSchema>;
