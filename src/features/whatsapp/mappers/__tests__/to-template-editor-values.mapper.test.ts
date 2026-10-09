import {
  abWithWinnerTemplateFixture,
  invoiceTemplateWithDocumentFixture,
} from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { WHATSAPP_TEMPLATE_USAGES } from "../../enums/whatsapp.enums";
import { toTemplateDisplayName, toTemplateEditorValues } from "../to-template-editor-values.mapper";

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
