import { WaPill } from "@/components/whatsapp/ui/WaPill";
import { waCaps } from "@/components/whatsapp/ui/wa-classes";
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
import { cn } from "@/lib/utils";
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
    <section aria-labelledby="template-preview-title" className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h3 id="template-preview-title" className={cn(waCaps, "m-0 text-center")}>
          Vista previa{values.abEnabled ? ` · versión ${showsB ? "B" : "A"}` : ""}
        </h3>
        <WaPill tone="warn" className="text-[11px]">
          Datos de muestra
        </WaPill>
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

      <p className="m-0 text-center text-xs text-wa-muted">
        Las variables se reemplazan con valores de ejemplo, no con un pedido real. La vista previa
        con pedidos reales está pendiente de integración.
      </p>
    </section>
  );
}
