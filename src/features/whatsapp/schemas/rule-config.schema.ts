import { z } from "zod";
import { WHATSAPP_SCHEDULING_LIMITS } from "../constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_RULE_DATE_MODES,
  WHATSAPP_RULE_WHEN_MODES,
  type WhatsAppRuleWhenMode,
} from "../enums/whatsapp.enums";
import { isValidDateKey, isValidTimeKey } from "../utils/lima-time.util";

const ruleConfigShape = z.object({
  templateId: z.string(),
  whenMode: z.enum(WHATSAPP_RULE_WHEN_MODES),
  delayMinutes: z.string(),
  fixedTime: z.string(),
  hoursBefore: z.string(),
  reminderEnabled: z.boolean(),
  reminderHours: z.string(),
  dateMode: z.enum(WHATSAPP_RULE_DATE_MODES),
  from: z.string(),
  to: z.string(),
  maxOrderAgeDays: z.string(),
  storeIds: z.array(z.string()),
  salesChannels: z.array(z.string()),
  shippingTypes: z.array(z.string()),
  courierIds: z.array(z.string()),
});

export type RuleConfigValues = z.infer<typeof ruleConfigShape>;

export function parseIntegerInRange(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= min && parsed <= max ? parsed : null;
}

const rangeMessage = (min: number, max: number) =>
  `Escribe un número entero entre ${min} y ${max.toLocaleString("es-PE")}.`;

export function createRuleConfigSchema(options: {
  allowedWhenModes: WhatsAppRuleWhenMode[];
  supportsReminder: boolean;
}) {
  return ruleConfigShape.superRefine((values, ctx) => {
    const addIssue = (path: keyof RuleConfigValues, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };
    const checkRange = (
      path: keyof RuleConfigValues,
      value: string,
      limits: { min: number; max: number },
    ) => {
      if (parseIntegerInRange(value, limits.min, limits.max) === null) {
        addIssue(path, rangeMessage(limits.min, limits.max));
      }
    };

    if (!values.templateId) addIssue("templateId", "Elige una plantilla.");

    if (!options.allowedWhenModes.includes(values.whenMode)) {
      addIssue("whenMode", "Este momento de envío no está disponible para este aviso.");
    } else if (values.whenMode === WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES) {
      checkRange("delayMinutes", values.delayMinutes, WHATSAPP_SCHEDULING_LIMITS.delayMinutes);
    } else if (values.whenMode === WHATSAPP_RULE_WHEN_MODES.FIXED_TIME) {
      if (!isValidTimeKey(values.fixedTime)) addIssue("fixedTime", "Elige una hora válida.");
    } else if (values.whenMode === WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY) {
      checkRange("hoursBefore", values.hoursBefore, WHATSAPP_SCHEDULING_LIMITS.hoursBeforeDelivery);
    }

    if (options.supportsReminder && values.reminderEnabled) {
      checkRange("reminderHours", values.reminderHours, WHATSAPP_SCHEDULING_LIMITS.reminderHours);
    }

    if (values.dateMode === WHATSAPP_RULE_DATE_MODES.RANGE) {
      if (!isValidDateKey(values.from)) {
        addIssue("from", "Elige la fecha de inicio.");
      } else if (values.to && !isValidDateKey(values.to)) {
        addIssue("to", "Elige una fecha válida o déjala vacía.");
      } else if (values.to && values.to < values.from) {
        addIssue("to", "La fecha final no puede ser anterior a la inicial.");
      }
    }

    checkRange(
      "maxOrderAgeDays",
      values.maxOrderAgeDays,
      WHATSAPP_SCHEDULING_LIMITS.maxOrderAgeDays,
    );
  });
}
