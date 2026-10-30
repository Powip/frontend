import {
  getRuleDefinition,
  getRuleDefinitionForTemplateUsage,
} from "../constants/whatsapp-scheduling-catalog";
import { WHATSAPP_TABS, type WhatsAppRuleKey } from "../enums/whatsapp.enums";
import type { WhatsAppTemplate } from "../models/template.model";

export const RULE_LINK_PARAMS = {
  rule: "rule",
  template: "template",
} as const;

export type RuleLinkResolution =
  | { kind: "none" }
  | { kind: "rule"; ruleKey: WhatsAppRuleKey; templateId: string | null }
  | { kind: "no-rule-for-template"; templateId: string | null }
  | { kind: "unknown-rule"; requestedKey: string; templateId: string | null };

export function buildActivateRuleSearch(
  currentSearch: string,
  template: Pick<WhatsAppTemplate, "id" | "usage">,
): string {
  const params = new URLSearchParams(currentSearch);
  params.set("tab", WHATSAPP_TABS.SCHEDULING);
  params.set(RULE_LINK_PARAMS.template, template.id);
  const definition = getRuleDefinitionForTemplateUsage(template.usage);
  if (definition) {
    params.set(RULE_LINK_PARAMS.rule, definition.key);
  } else {
    params.delete(RULE_LINK_PARAMS.rule);
  }
  return params.toString();
}

export function resolveRuleLink(params: URLSearchParams): RuleLinkResolution {
  const requestedRule = params.get(RULE_LINK_PARAMS.rule);
  const templateId = params.get(RULE_LINK_PARAMS.template);
  if (!requestedRule) {
    return templateId ? { kind: "no-rule-for-template", templateId } : { kind: "none" };
  }
  const definition = getRuleDefinition(requestedRule);
  if (!definition) return { kind: "unknown-rule", requestedKey: requestedRule, templateId };
  return { kind: "rule", ruleKey: definition.key, templateId };
}
