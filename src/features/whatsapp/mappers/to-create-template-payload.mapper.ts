import {
  getTemplateSampleValues,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
} from "../constants/whatsapp-template-catalog";
import { WHATSAPP_TEMPLATE_HEADER_TYPES } from "../enums/whatsapp.enums";
import type { TemplateEditorValues } from "../schemas/template-editor.schema";
import { toTemplateTechnicalName } from "../utils/template-name.util";
import { extractTemplateVariables } from "../utils/template-render.util";

/** Botón de rastreo: Meta exige URL fija + {{1}} y un ejemplo completo. */
const TRACKING_BUTTON_URL = "https://powip.lat/r/{{1}}";
const TRACKING_BUTTON_EXAMPLE = "https://powip.lat/r/K7X2Q";

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: string;
  components: Array<Record<string, unknown>>;
}

/** Ejemplos para Meta solo de las variables que usa ese texto, con las muestras del catálogo. */
function namedExamples(text: string): Array<{ param_name: string; example: string }> {
  const samples = getTemplateSampleValues();
  const names = [...new Set(extractTemplateVariables(text).map(String))];
  return names.map((name) => ({ param_name: name, example: samples[name] ?? name }));
}

/**
 * Arma lo que se manda a POST /whatsapp/templates desde el editor.
 * El encabezado PDF (Comprobante emitido) y la versión B del A/B todavía no se envían.
 */
export function toCreateTemplatePayload(values: TemplateEditorValues): CreateTemplatePayload {
  const components: Array<Record<string, unknown>> = [];

  if (values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && values.headerText.trim()) {
    const examples = namedExamples(values.headerText);
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: values.headerText.trim(),
      ...(examples.length > 0 ? { example: { header_text_named_params: examples } } : {}),
    });
  }

  const bodyExamples = namedExamples(values.body);
  components.push({
    type: "BODY",
    text: values.body.trim(),
    ...(bodyExamples.length > 0 ? { example: { body_text_named_params: bodyExamples } } : {}),
  });

  if (values.footer.trim()) {
    components.push({ type: "FOOTER", text: values.footer.trim() });
  }

  const buttons: Array<Record<string, unknown>> = [
    {
      type: "URL",
      text: values.buttonText.trim(),
      url: TRACKING_BUTTON_URL,
      example: [TRACKING_BUTTON_EXAMPLE],
    },
  ];
  if (values.quickReply) {
    buttons.push({ type: "QUICK_REPLY", text: WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT });
  }
  components.push({ type: "BUTTONS", buttons });

  return {
    name: toTemplateTechnicalName(values.displayName),
    language: values.language,
    category: values.category,
    components,
  };
}