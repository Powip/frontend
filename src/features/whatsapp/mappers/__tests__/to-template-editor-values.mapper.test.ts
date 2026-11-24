import {
  abWithWinnerTemplateFixture,
  invoiceTemplateWithDocumentFixture,
} from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { WHATSAPP_TEMPLATE_USAGES } from "../../enums/whatsapp.enums";
import { toTemplateDisplayName, toTemplateEditorValues } from "../to-template-editor-values.mapper";
import { toWhatsAppTemplate } from "../to-whatsapp-template.mapper";
import type { WhatsAppTemplateDto } from "../../api/templates.api";

describe("toTemplateEditorValues", () => {
  it("convierte una plantilla con A/B a valores del editor", () => {
    expect(toTemplateEditorValues(abWithWinnerTemplateFixture)).toEqual({
      displayName: "Pedido en camino",
      usage: WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT,
      category: "UTILITY",
      language: "es_PE",
      headerType: "text",
      headerText: "📦 Tu pedido va en camino",
      body: abWithWinnerTemplateFixture.body,
      footer: "Responde STOP para no recibir avisos",
      buttonText: "Rastrear mi pedido",
      quickReply: false,
      abEnabled: true,
      bodyB: abWithWinnerTemplateFixture.abTest?.bodyB,
      abMinSendsPerVariant: "200",
    });
  });

  it("al duplicar cambia el nombre y conserva el contenido", () => {
    const values = toTemplateEditorValues(invoiceTemplateWithDocumentFixture, "duplicate");
    expect(values.displayName).toBe("Comprobante emitido copia");
    expect(values.headerType).toBe("document");
    expect(values.body).toBe(invoiceTemplateWithDocumentFixture.body);
  });

  it("usa Solo envíos programados si la plantilla no tiene uso", () => {
    expect(toTemplateEditorValues({ ...abWithWinnerTemplateFixture, usage: null }).usage).toBe(
      WHATSAPP_TEMPLATE_USAGES.SCHEDULED_ONLY,
    );
  });

  it("muestra el nombre técnico como nombre legible", () => {
    expect(toTemplateDisplayName("pedido__en_camino_")).toBe("Pedido en camino");
  });
});

describe("plantilla traída de Meta al editor", () => {
  const dto: WhatsAppTemplateDto = {
    id: "tpl-1",
    name: "hello_world",
    language: "en_US",
    category: "UTILITY",
    status: "APPROVED",
    components: [
      { type: "HEADER", format: "TEXT", text: "Hello World" },
      { type: "BODY", text: "Welcome and congratulations!!" },
      { type: "FOOTER", text: "WhatsApp Business Platform sample message" },
    ],
    updatedAt: "2026-11-24T22:00:00.000Z",
  } as WhatsAppTemplateDto;

  it("carga mensaje, encabezado y pie desde los componentes de Meta", () => {
    const values = toTemplateEditorValues(toWhatsAppTemplate(dto));
    expect(values.body).toBe("Welcome and congratulations!!");
    expect(values.headerType).toBe("text");
    expect(values.headerText).toBe("Hello World");
    expect(values.footer).toBe("WhatsApp Business Platform sample message");
  });

  it("no cambia a español un idioma que el editor no ofrece", () => {
    expect(toWhatsAppTemplate(dto).language).toBeNull();
    expect(toTemplateEditorValues(toWhatsAppTemplate(dto)).language).toBe("");
    expect(toTemplateEditorValues(toWhatsAppTemplate(dto), "duplicate").language).toBe("es_PE");
    expect(toWhatsAppTemplate({ ...dto, language: "es_PE" }).language).toBe("es_PE");
  });
});
