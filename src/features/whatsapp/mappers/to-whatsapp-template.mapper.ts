import type { WhatsAppTemplateComponentDto, WhatsAppTemplateDto } from "../api/templates.api";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateLanguage,
  type WhatsAppTemplateStatus,
} from "../enums/whatsapp.enums";
import type { WhatsAppTemplate, WhatsAppTemplateHeader } from "../models/template.model";

function findComponent(
  components: WhatsAppTemplateComponentDto[],
  type: string,
): WhatsAppTemplateComponentDto | undefined {
  return components.find((component) => component.type?.toUpperCase() === type);
}

function toStatus(status: string): WhatsAppTemplateStatus {
  const value = status?.toUpperCase();
  if ((Object.values(WHATSAPP_TEMPLATE_STATUSES) as string[]).includes(value)) {
    return value as WhatsAppTemplateStatus;
  }
  // Meta usa DISABLED cuando pausa por calidad; cualquier otro estado se trata como en revisión.
  return value === "DISABLED" ? WHATSAPP_TEMPLATE_STATUSES.PAUSED : WHATSAPP_TEMPLATE_STATUSES.PENDING;
}

function toCategory(category: string): WhatsAppTemplateCategory {
  return category?.toUpperCase() === WHATSAPP_TEMPLATE_CATEGORIES.MARKETING
    ? WHATSAPP_TEMPLATE_CATEGORIES.MARKETING
    : WHATSAPP_TEMPLATE_CATEGORIES.UTILITY;
}

function toLanguage(language: string): WhatsAppTemplateLanguage {
  return language === WHATSAPP_TEMPLATE_LANGUAGES.SPANISH_PERU
    ? WHATSAPP_TEMPLATE_LANGUAGES.SPANISH_PERU
    : WHATSAPP_TEMPLATE_LANGUAGES.SPANISH;
}

function toHeader(component: WhatsAppTemplateComponentDto | undefined): WhatsAppTemplateHeader {
  if (!component) return { type: WHATSAPP_TEMPLATE_HEADER_TYPES.NONE, text: null };
  if (component.format?.toUpperCase() === "DOCUMENT") {
    return { type: WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT, text: null };
  }
  return { type: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, text: component.text ?? null };
}

export function toWhatsAppTemplate(dto: WhatsAppTemplateDto): WhatsAppTemplate {
  const components = Array.isArray(dto.components) ? dto.components : [];
  const buttons = findComponent(components, "BUTTONS")?.buttons ?? [];
  const linkButton = buttons.find((button) => button.type?.toUpperCase() === "URL");

  return {
    id: dto.id,
    storeId: null, // las plantillas son por empresa (WABA), no por tienda
    name: dto.name,
    usage: null, // el backend todavía no guarda el uso ("Se usa en")
    category: toCategory(dto.category),
    language: toLanguage(dto.language),
    status: toStatus(dto.status),
    metaReason: null,
    header: toHeader(findComponent(components, "HEADER")),
    body: findComponent(components, "BODY")?.text ?? "",
    footer: findComponent(components, "FOOTER")?.text ?? null,
    buttonText: linkButton?.text ?? null,
    quickReply: buttons.some((button) => button.type?.toUpperCase() === "QUICK_REPLY"),
    abTest: null,
    approvedVersion: null,
    stats30d: null,
    updatedAt: new Date(dto.updatedAt),
  };
}