import { z } from "zod";
import {
  ALERT_DEFINITIONS,
  ALERT_SETTINGS_SUGGESTED,
  PROTECTION_SETTINGS_SUGGESTED,
} from "../constants/whatsapp-settings-catalog";
import {
  WHATSAPP_ALERT_RECIPIENTS,
  WHATSAPP_ALERT_TYPES,
  WHATSAPP_FOREIGN_INBOUND_POLICIES,
} from "../enums/whatsapp.enums";
import type {
  WhatsAppAlertSettings,
  WhatsAppProtectionSettings,
} from "../models/settings-tab.model";
import { normalizeOptOutPhone } from "../utils/opt-out-phone.util";
import { parseIntegerInRange } from "./rule-config.schema";

export const OPT_OUT_LIMITS = { customerName: 80, note: 200, reactivationNoteMin: 5 } as const;

export const addOptOutSchema = z
  .object({
    phone: z.string(),
    customerName: z.string(),
    storeId: z.string(),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.phone.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Escribe el teléfono." });
    } else if (!normalizeOptOutPhone(values.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Escribe un celular de Perú: 9 dígitos que empiezan en 9, con o sin +51.",
      });
    }
    if (values.customerName.length > OPT_OUT_LIMITS.customerName) {
      ctx.addIssue({
        code: "custom",
        path: ["customerName"],
        message: `Máximo ${OPT_OUT_LIMITS.customerName} caracteres.`,
      });
    }
    if (!values.storeId) {
      ctx.addIssue({ code: "custom", path: ["storeId"], message: "Elige la tienda." });
    }
    if (values.note.length > OPT_OUT_LIMITS.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: `Máximo ${OPT_OUT_LIMITS.note} caracteres.`,
      });
    }
  });

export type AddOptOutValues = z.infer<typeof addOptOutSchema>;

export const reactivateOptOutSchema = z
  .object({ customerRequested: z.boolean(), note: z.string() })
  .superRefine((values, ctx) => {
    if (!values.customerRequested) {
      ctx.addIssue({
        code: "custom",
        path: ["customerRequested"],
        message: "Solo se reactiva si el comprador lo pidió.",
      });
    }
    const note = values.note.trim();
    if (note.length < OPT_OUT_LIMITS.reactivationNoteMin) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Cuenta cómo lo pidió (por ejemplo: «escribió al chat el 9 oct»).",
      });
    } else if (note.length > OPT_OUT_LIMITS.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: `Máximo ${OPT_OUT_LIMITS.note} caracteres.`,
      });
    }
  });

export type ReactivateOptOutValues = z.infer<typeof reactivateOptOutSchema>;

const alertRuleValuesSchema = z.object({
  type: z.enum(WHATSAPP_ALERT_TYPES),
  enabled: z.boolean(),
  threshold: z.string(),
});

export const alertSettingsSchema = z
  .object({
    rules: z.array(alertRuleValuesSchema),
    recipients: z.enum(WHATSAPP_ALERT_RECIPIENTS),
    pauseCampaignsOnRed: z.boolean(),
  })
  .superRefine((values, ctx) => {
    values.rules.forEach((rule, index) => {
      const definition = ALERT_DEFINITIONS.find((item) => item.type === rule.type);
      if (!definition || definition.unit === null || !rule.enabled) return;
      const min = definition.min ?? 1;
      const max = definition.max ?? 100;
      if (parseIntegerInRange(rule.threshold, min, max) === null) {
        const unit = definition.unit === "percent" ? "%" : " minutos";
        ctx.addIssue({
          code: "custom",
          path: ["rules", index, "threshold"],
          message: `Escribe un número entero entre ${min} y ${max}${unit}.`,
        });
      }
    });
  });

export type AlertSettingsValues = z.infer<typeof alertSettingsSchema>;

export function toAlertSettingsValues(settings: WhatsAppAlertSettings | null): AlertSettingsValues {
  return {
    rules: ALERT_DEFINITIONS.map((definition) => {
      const saved = settings?.rules.find((rule) => rule.type === definition.type);
      const threshold = saved ? saved.threshold : definition.suggestedThreshold;
      return {
        type: definition.type,
        enabled: saved ? saved.enabled : true,
        threshold: threshold === null ? "" : String(threshold),
      };
    }),
    recipients: settings?.recipients ?? ALERT_SETTINGS_SUGGESTED.recipients,
    pauseCampaignsOnRed:
      settings?.pauseCampaignsOnRed ?? ALERT_SETTINGS_SUGGESTED.pauseCampaignsOnRed,
  };
}

export const protectionSettingsSchema = z.object({
  optOutByKeyword: z.boolean(),
  foreignInbound: z.enum(WHATSAPP_FOREIGN_INBOUND_POLICIES),
  allowForeignOutbound: z.boolean(),
});

export type ProtectionSettingsValues = z.infer<typeof protectionSettingsSchema>;

export function toProtectionSettingsValues(
  settings: WhatsAppProtectionSettings | null,
): ProtectionSettingsValues {
  return {
    optOutByKeyword: settings?.optOutByKeyword ?? PROTECTION_SETTINGS_SUGGESTED.optOutByKeyword,
    foreignInbound: settings?.foreignInbound ?? PROTECTION_SETTINGS_SUGGESTED.foreignInbound,
    allowForeignOutbound:
      settings?.allowForeignOutbound ?? PROTECTION_SETTINGS_SUGGESTED.allowForeignOutbound,
  };
}
