import { z } from "zod";
import {
  CONTINGENCY_LIMITS,
  CONTINGENCY_SUGGESTED,
} from "../constants/whatsapp-connection-catalog";
import type { WhatsAppContingencySettings } from "../models/connection.model";
import { normalizeOptOutPhone } from "../utils/opt-out-phone.util";
import { parseIntegerInRange } from "./rule-config.schema";

export const testMessageSchema = z
  .object({ phone: z.string(), templateId: z.string() })
  .superRefine((values, ctx) => {
    if (!normalizeOptOutPhone(values.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Escribe un celular de Perú: 9 dígitos que empiezan en 9, con o sin +51.",
      });
    }
    if (!values.templateId) {
      ctx.addIssue({
        code: "custom",
        path: ["templateId"],
        message: "Elige una plantilla aprobada.",
      });
    }
  });

export type TestMessageValues = z.infer<typeof testMessageSchema>;

export const contingencySchema = z
  .object({
    enabled: z.boolean(),
    onRestrictedOrRed: z.boolean(),
    onDailyLimit: z.boolean(),
    failuresEnabled: z.boolean(),
    failuresCount: z.string(),
    failuresMinutes: z.string(),
    manualOnly: z.boolean(),
    senderType: z.enum(["all_agents", "user"]),
    senderUserId: z.string(),
  })
  .superRefine((values, ctx) => {
    const addIssue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (
      values.manualOnly &&
      (values.onRestrictedOrRed || values.onDailyLimit || values.failuresEnabled)
    ) {
      addIssue("manualOnly", "«Solo cuando yo la active» no se combina con los demás motivos.");
    }
    if (
      values.enabled &&
      !values.manualOnly &&
      !values.onRestrictedOrRed &&
      !values.onDailyLimit &&
      !values.failuresEnabled
    ) {
      addIssue("manualOnly", "Elige al menos un motivo para pasar a contingencia.");
    }
    if (values.failuresEnabled) {
      const { failuresCount, failuresMinutes } = CONTINGENCY_LIMITS;
      if (
        parseIntegerInRange(values.failuresCount, failuresCount.min, failuresCount.max) === null
      ) {
        addIssue(
          "failuresCount",
          `Escribe un número entero entre ${failuresCount.min} y ${failuresCount.max}.`,
        );
      }
      if (
        parseIntegerInRange(values.failuresMinutes, failuresMinutes.min, failuresMinutes.max) ===
        null
      ) {
        addIssue(
          "failuresMinutes",
          `Escribe un número entero entre ${failuresMinutes.min} y ${failuresMinutes.max}.`,
        );
      }
    }
    if (values.senderType === "user" && !values.senderUserId) {
      addIssue("senderUserId", "Elige quién envía los mensajes asistidos.");
    }
  });

export type ContingencyValues = z.infer<typeof contingencySchema>;

export function toContingencyValues(
  settings: WhatsAppContingencySettings | null,
): ContingencyValues {
  if (!settings) return { ...CONTINGENCY_SUGGESTED };
  return {
    enabled: settings.enabled,
    onRestrictedOrRed: settings.triggers.onRestrictedOrRed,
    onDailyLimit: settings.triggers.onDailyLimit,
    failuresEnabled: settings.triggers.onConsecutiveFailures.enabled,
    failuresCount: String(settings.triggers.onConsecutiveFailures.count),
    failuresMinutes: String(settings.triggers.onConsecutiveFailures.minutes),
    manualOnly: settings.triggers.manualOnly,
    senderType: settings.sender.type,
    senderUserId: settings.sender.userId ?? "",
  };
}
