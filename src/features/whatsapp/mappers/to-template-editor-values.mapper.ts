import { WHATSAPP_TEMPLATE_LIMITS } from "../constants/whatsapp-template-catalog";
import { WHATSAPP_TEMPLATE_USAGES } from "../enums/whatsapp.enums";
import type { WhatsAppTemplate } from "../models/template.model";
import { createTemplateEditorDefaultValues } from "../schemas/template-editor.defaults";
import type { TemplateEditorValues } from "../schemas/template-editor.schema";

export function toTemplateDisplayName(technicalName: string): string {
  const spaced = technicalName.replace(/_+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function toTemplateEditorValues(
  template: WhatsAppTemplate,
  mode: "edit" | "duplicate" = "edit",
): TemplateEditorValues {
  const defaults = createTemplateEditorDefaultValues();
  const displayName = toTemplateDisplayName(template.name);
  return {
    ...defaults,
    displayName: mode === "duplicate" ? `${displayName} copia` : displayName,
    usage: template.usage ?? WHATSAPP_TEMPLATE_USAGES.SCHEDULED_ONLY,
    category: template.category,
    language: template.language,
    headerType: template.header.type,
    headerText: template.header.text ?? "",
    body: template.body,
    footer: template.footer ?? "",
    buttonText: template.buttonText ?? "",
    quickReply: template.quickReply,
    abEnabled: template.abTest?.enabled ?? false,
    bodyB: template.abTest?.bodyB ?? "",
    abMinSendsPerVariant: String(
      template.abTest?.minSendsPerVariant ?? WHATSAPP_TEMPLATE_LIMITS.minSendsPerVariant.default,
    ),
  };
}
