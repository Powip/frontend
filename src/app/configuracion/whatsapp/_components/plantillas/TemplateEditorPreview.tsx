import { WhatsAppPhonePreview } from "@/components/whatsapp/WhatsAppPhonePreview";
import {
  getTemplateSampleValues,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
  WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_AB_VARIANTS,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  type WhatsAppAbVariant,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { TemplateEditorValues } from "@/features/whatsapp/schemas/template-editor.schema";
import { TemplateSegmentedChoice } from "./TemplateSegmentedChoice";

const SAMPLE_VALUES = getTemplateSampleValues();

interface TemplateEditorPreviewProps {
  values: TemplateEditorValues;
  businessName: string;
  variant: WhatsAppAbVariant;
  onVariantChange: (variant: WhatsAppAbVariant) => void;
}

export function TemplateEditorPreview({
  values,
  businessName,
  variant,
  onVariantChange,
}: TemplateEditorPreviewProps) {
  const showsB = values.abEnabled && variant === WHATSAPP_AB_VARIANTS.B;
  const header =
    values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && values.headerText.trim()
      ? { type: "text" as const, text: values.headerText }
      : values.headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT
        ? { type: "document" as const, fileName: WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME }
        : null;

  return (
    <section aria-labelledby="template-preview-title" className="min-w-0 space-y-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="template-preview-title" className="text-sm font-semibold">
            Vista previa{values.abEnabled ? ` · versión ${showsB ? "B" : "A"}` : ""}
          </h3>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Datos de muestra
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Las variables se reemplazan con valores de ejemplo, no con un pedido real. La vista previa
          con pedidos reales está pendiente de integración.
        </p>
      </div>

      {values.abEnabled && (
        <TemplateSegmentedChoice
          legend="Versión a previsualizar"
          name="template-preview-variant"
          value={variant}
          options={[
            { value: WHATSAPP_AB_VARIANTS.A, label: "Vista previa A" },
            { value: WHATSAPP_AB_VARIANTS.B, label: "Vista previa B" },
          ]}
          onValueChange={onVariantChange}
        />
      )}

      <WhatsAppPhonePreview
        businessName={businessName}
        body={showsB ? values.bodyB : values.body}
        values={SAMPLE_VALUES}
        header={header}
        footer={values.footer}
        buttonText={values.buttonText}
        quickReplyText={values.quickReply ? WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT : null}
        timeLabel="10:02"
        emptyBodyLabel={showsB ? "Escribe el mensaje de la versión B…" : "Escribe tu mensaje…"}
      />
    </section>
  );
}
