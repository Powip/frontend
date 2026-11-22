import {
  WHATSAPP_TEMPLATE_DEFAULT_BUTTON_TEXT,
  WHATSAPP_TEMPLATE_DEFAULT_FOOTER,
  WHATSAPP_TEMPLATE_LIMITS,
} from "../constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  WHATSAPP_TEMPLATE_USAGES,
} from "../enums/whatsapp.enums";
import type { TemplateEditorValues } from "./template-editor.schema";

export function createTemplateEditorDefaultValues(): TemplateEditorValues {
  return {
    displayName: "",
    usage: WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT,
    category: WHATSAPP_TEMPLATE_CATEGORIES.UTILITY,
    language: WHATSAPP_TEMPLATE_LANGUAGES.SPANISH_PERU,
    headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.NONE,
    headerText: "",
    body: "",
    footer: WHATSAPP_TEMPLATE_DEFAULT_FOOTER,
    buttonText: WHATSAPP_TEMPLATE_DEFAULT_BUTTON_TEXT,
    quickReply: false,
    abEnabled: false,
    bodyB: "",
    abMinSendsPerVariant: String(WHATSAPP_TEMPLATE_LIMITS.minSendsPerVariant.default),
  };
}
