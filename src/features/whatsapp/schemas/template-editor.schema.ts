import { z } from "zod";
import {
  getTemplateUsageDefinition,
  WHATSAPP_TEMPLATE_LIMITS,
} from "../constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_LANGUAGES,
  WHATSAPP_TEMPLATE_USAGES,
} from "../enums/whatsapp.enums";
import { toTemplateTechnicalName } from "../utils/template-name.util";
import {
  extractTemplateVariables,
  findUnknownTemplateVariables,
  hasMalformedVariableTokens,
} from "../utils/template-render.util";
import { getAllowedTemplateVariableKeys } from "../utils/template-variables.util";

export const templateEditorSchema = z
  .object({
    displayName: z.string(),
    usage: z.enum(WHATSAPP_TEMPLATE_USAGES, { error: "Elige dónde se usa la plantilla." }),
    category: z.enum(WHATSAPP_TEMPLATE_CATEGORIES, { error: "Elige una categoría." }),
    language: z.enum(WHATSAPP_TEMPLATE_LANGUAGES, { error: "Elige un idioma." }),
    headerType: z.enum(WHATSAPP_TEMPLATE_HEADER_TYPES),
    headerText: z.string(),
    body: z.string(),
    footer: z.string(),
    buttonText: z.string(),
    quickReply: z.boolean(),
    abEnabled: z.boolean(),
    bodyB: z.string(),
    abMinSendsPerVariant: z.string(),
  })
  .superRefine((values, ctx) => {
    const usageDefinition = getTemplateUsageDefinition(values.usage);
    const usageLabel = usageDefinition?.label ?? "este uso";
    const allowedVariables = getAllowedTemplateVariableKeys(values.usage);

    const addIssue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };

    const checkVariables = (path: string, text: string) => {
      if (hasMalformedVariableTokens(text)) {
        addIssue(path, "Revisa las llaves: las variables se escriben así: {{cliente}}.");
        return;
      }
      const unknown = findUnknownTemplateVariables(text, allowedVariables);
      if (unknown.length > 0) {
        addIssue(
          path,
          `${unknown.map((name) => `{{${name}}}`).join(", ")} no está disponible para «${usageLabel}».`,
        );
      }
    };

    const checkMessage = (path: string, text: string, label: string) => {
      if (!text.trim()) {
        addIssue(path, `Escribe ${label}.`);
        return;
      }
      if (text.length > WHATSAPP_TEMPLATE_LIMITS.body) {
        addIssue(path, `Máximo ${WHATSAPP_TEMPLATE_LIMITS.body} caracteres.`);
        return;
      }
      checkVariables(path, text);
    };

    if (!values.displayName.trim()) {
      addIssue("displayName", "Escribe un nombre interno.");
    } else if (!toTemplateTechnicalName(values.displayName)) {
      addIssue("displayName", "Usa al menos una letra o un número.");
    } else if (values.displayName.length > WHATSAPP_TEMPLATE_LIMITS.technicalName) {
      addIssue("displayName", `Máximo ${WHATSAPP_TEMPLATE_LIMITS.technicalName} caracteres.`);
    }

    if (values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT) {
      if (!values.headerText.trim()) {
        addIssue("headerText", "Escribe el encabezado o elige «Ninguno».");
      } else if (values.headerText.length > WHATSAPP_TEMPLATE_LIMITS.headerText) {
        addIssue("headerText", `Máximo ${WHATSAPP_TEMPLATE_LIMITS.headerText} caracteres.`);
      } else if (
        extractTemplateVariables(values.headerText).length >
        WHATSAPP_TEMPLATE_LIMITS.headerVariables
      ) {
        addIssue("headerText", "El encabezado admite una sola variable.");
      } else {
        checkVariables("headerText", values.headerText);
      }
    }

    if (
      values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT &&
      !usageDefinition?.allowsDocumentHeader
    ) {
      addIssue("headerType", "El encabezado PDF solo está disponible para «Comprobante emitido».");
    }

    checkMessage("body", values.body, "el mensaje");

    if (values.footer.length > WHATSAPP_TEMPLATE_LIMITS.footer) {
      addIssue("footer", `Máximo ${WHATSAPP_TEMPLATE_LIMITS.footer} caracteres.`);
    } else if (values.footer.includes("{{") || values.footer.includes("}}")) {
      addIssue("footer", "El pie no admite variables.");
    }

    if (!values.buttonText.trim()) {
      addIssue("buttonText", "Escribe el texto del botón.");
    } else if (values.buttonText.length > WHATSAPP_TEMPLATE_LIMITS.buttonText) {
      addIssue("buttonText", `Máximo ${WHATSAPP_TEMPLATE_LIMITS.buttonText} caracteres.`);
    } else if (values.buttonText.includes("{{") || values.buttonText.includes("}}")) {
      addIssue("buttonText", "El texto del botón no admite variables.");
    }

    if (values.abEnabled) {
      checkMessage("bodyB", values.bodyB, "el mensaje de la versión B");
      const { min, max } = WHATSAPP_TEMPLATE_LIMITS.minSendsPerVariant;
      const minSends = Number(values.abMinSendsPerVariant);
      if (!/^\d+$/.test(values.abMinSendsPerVariant.trim()) || minSends < min || minSends > max) {
        addIssue(
          "abMinSendsPerVariant",
          `Escribe un número entero entre ${min} y ${max.toLocaleString("es-PE")}.`,
        );
      }
    }
  });

export type TemplateEditorValues = z.infer<typeof templateEditorSchema>;
