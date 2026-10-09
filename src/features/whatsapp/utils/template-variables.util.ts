import {
  getTemplateUsageDefinition,
  WHATSAPP_TEMPLATE_VARIABLES,
  type WhatsAppTemplateVariableDefinition,
} from "../constants/whatsapp-template-catalog";
import type { WhatsAppTemplateUsage } from "../enums/whatsapp.enums";

export interface TextInsertionResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function clampIndex(index: number | null | undefined, length: number): number {
  if (index === null || index === undefined || Number.isNaN(index)) return length;
  return Math.min(Math.max(index, 0), length);
}

export function insertTextAtSelection(
  value: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
  text: string,
): TextInsertionResult {
  const start = clampIndex(selectionStart, value.length);
  const end = Math.max(start, clampIndex(selectionEnd, value.length));
  const caret = start + text.length;
  return {
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

export function toVariableToken(key: string): string {
  return `{{${key}}}`;
}

export function getAllowedTemplateVariables(
  usage: WhatsAppTemplateUsage | null | undefined,
): WhatsAppTemplateVariableDefinition[] {
  const definition = getTemplateUsageDefinition(usage);
  if (!definition) return WHATSAPP_TEMPLATE_VARIABLES;
  return WHATSAPP_TEMPLATE_VARIABLES.filter((variable) =>
    definition.variableKeys.includes(variable.key),
  );
}

export function getAllowedTemplateVariableKeys(
  usage: WhatsAppTemplateUsage | null | undefined,
): string[] {
  return getAllowedTemplateVariables(usage).map((variable) => variable.key);
}
