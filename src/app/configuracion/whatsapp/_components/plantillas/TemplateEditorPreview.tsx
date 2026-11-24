import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import { waCaps, waSelectTrigger } from "@/components/whatsapp/ui/wa-classes";
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
import type { WhatsAppTemplateSampleOrder } from "@/features/whatsapp/api/template-catalog.api";
import type { TemplateEditorValues } from "@/features/whatsapp/schemas/template-editor.schema";
import { cn } from "@/lib/utils";
import { TemplateSegmentedChoice } from "./TemplateSegmentedChoice";

const SAMPLE_VALUES = getTemplateSampleValues();
const SAMPLE_OPTION = "__sample__";

interface TemplateEditorPreviewProps {
  values: TemplateEditorValues;
  businessName: string;
  variant: WhatsAppAbVariant;
  onVariantChange: (variant: WhatsAppAbVariant) => void;
  /** C-14: pedidos reales para previsualizar. Sin ellos se usan datos de muestra. */
  sampleOrders?: WhatsAppTemplateSampleOrder[] | null;
}

export function TemplateEditorPreview({
  values,
  businessName,
  variant,
  onVariantChange,
  sampleOrders,
}: TemplateEditorPreviewProps) {
  const orders = sampleOrders ?? [];
  const [orderId, setOrderId] = useState(SAMPLE_OPTION);
  const selectedOrder = orders.find((order) => order.orderId === orderId) ?? null;
  // Con un pedido real solo se usan sus datos: una variable sin dato queda visible como faltante.
  const previewValues = useMemo(
    () =>
      selectedOrder
        ? Object.fromEntries(
            Object.entries(selectedOrder.values).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : SAMPLE_VALUES,
    [selectedOrder],
  );
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
        <WaPill tone={selectedOrder ? "ok" : "warn"} className="text-[11px]">
          {selectedOrder ? `Pedido ${selectedOrder.orderNumber}` : "Datos de muestra"}
        </WaPill>
      </div>

      {orders.length > 0 && (
        <Select value={orderId} onValueChange={(value) => value && setOrderId(value)}>
          <SelectTrigger className={waSelectTrigger} aria-label="Previsualizar con un pedido">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAMPLE_OPTION}>Datos de muestra</SelectItem>
            {orders.map((order) => (
              <SelectItem key={order.orderId} value={order.orderId}>
                {order.orderNumber}
                {order.customerName ? ` · ${order.customerName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
        values={previewValues}
        header={header}
        footer={values.footer}
        buttonText={values.buttonText}
        quickReplyText={values.quickReply ? WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT : null}
        timeLabel="10:02"
        emptyBodyLabel={showsB ? "Escribe el mensaje de la versión B…" : "Escribe tu mensaje…"}
      />

      <p className="m-0 text-center text-xs text-wa-muted">
        {selectedOrder
          ? "Variables con los datos de este pedido. Las que quedan entre llaves no tienen ese dato en el pedido."
          : orders.length > 0
            ? "Las variables se reemplazan con valores de ejemplo. Elige un pedido para ver cómo le llegaría."
            : "Las variables se reemplazan con valores de ejemplo, no con un pedido real."}
      </p>
    </section>
  );
}
