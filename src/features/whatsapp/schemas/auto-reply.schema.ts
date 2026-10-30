import { z } from "zod";
import {
  AUTO_REPLY_SUGGESTED,
  AUTO_REPLY_VARIABLES,
  CONVERSATION_LIMITS,
} from "../constants/whatsapp-conversation-catalog";
import type { WhatsAppAutoReplySettings } from "../models/conversation.model";
import {
  findUnknownTemplateVariables,
  hasMalformedVariableTokens,
} from "../utils/template-render.util";

export const AUTO_REPLY_VARIABLE_KEYS: string[] = AUTO_REPLY_VARIABLES.map(
  (variable) => variable.key,
);

function validateAutoReplyText(
  text: string,
  required: boolean,
  addIssue: (message: string) => void,
) {
  if (required && text.trim().length === 0) {
    addIssue("Escribe el mensaje.");
    return;
  }
  if (text.length > CONVERSATION_LIMITS.autoReplyMaxLength) {
    addIssue(
      `Máximo ${CONVERSATION_LIMITS.autoReplyMaxLength.toLocaleString("es-PE")} caracteres.`,
    );
    return;
  }
  if (hasMalformedVariableTokens(text)) {
    addIssue("Revisa las llaves: cada variable se escribe como {{nombre}}.");
    return;
  }
  const unknown = findUnknownTemplateVariables(text, AUTO_REPLY_VARIABLE_KEYS);
  if (unknown.length > 0) {
    addIssue(
      `Solo puedes usar {{cliente}} y {{link_rastreo}}. Quita: ${unknown.map((key) => `{{${key}}}`).join(", ")}.`,
    );
  }
}

export const autoReplySchema = z
  .object({
    enabled: z.boolean(),
    inHoursText: z.string(),
    outOfHoursText: z.string(),
  })
  .superRefine((values, ctx) => {
    validateAutoReplyText(values.inHoursText, values.enabled, (message) =>
      ctx.addIssue({ code: "custom", path: ["inHoursText"], message }),
    );
    validateAutoReplyText(values.outOfHoursText, values.enabled, (message) =>
      ctx.addIssue({ code: "custom", path: ["outOfHoursText"], message }),
    );
  });

export type AutoReplyValues = z.infer<typeof autoReplySchema>;

export function toAutoReplyValues(settings: WhatsAppAutoReplySettings | null): AutoReplyValues {
  if (!settings) {
    return {
      enabled: AUTO_REPLY_SUGGESTED.enabled,
      inHoursText: AUTO_REPLY_SUGGESTED.inHoursText,
      outOfHoursText: AUTO_REPLY_SUGGESTED.outOfHoursText,
    };
  }
  return {
    enabled: settings.enabled,
    inHoursText: settings.inHoursText,
    outOfHoursText: settings.outOfHoursText,
  };
}
