import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waDialogBody,
  waDialogContent,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppPhonePreview } from "@/components/whatsapp/WhatsAppPhonePreview";
import {
  getTemplateSampleValues,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
  WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import { WHATSAPP_TEMPLATE_HEADER_TYPES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { cn } from "@/lib/utils";

interface RuleMessagePreviewDialogProps {
  template: WhatsAppTemplate | null;
  businessName: string;
  onClose: () => void;
}

export function RuleMessagePreviewDialog({
  template,
  businessName,
  onClose,
}: RuleMessagePreviewDialogProps) {
  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(waDialogContent, "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[440px]")}
      >
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Mensaje del aviso</DialogTitle>
          <WaDialogClose />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex min-h-0 flex-col gap-3.5 overflow-y-auto")}>
          <DialogDescription className="m-0 text-xs text-wa-muted">
            {template ? (
              <>
                Plantilla <span className="break-all font-wa-mono">{template.name}</span>, con datos
                de muestra (no es un pedido real).
              </>
            ) : null}
          </DialogDescription>
          {template && (
            <WhatsAppPhonePreview
              businessName={businessName}
              body={template.body}
              values={getTemplateSampleValues()}
              header={
                template.header.type === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && template.header.text
                  ? { type: "text", text: template.header.text }
                  : template.header.type === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT
                    ? { type: "document", fileName: WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME }
                    : null
              }
              footer={template.footer}
              buttonText={template.buttonText}
              quickReplyText={template.quickReply ? WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT : null}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
