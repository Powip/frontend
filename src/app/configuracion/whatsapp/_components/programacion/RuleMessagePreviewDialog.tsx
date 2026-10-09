import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppPhonePreview } from "@/components/whatsapp/WhatsAppPhonePreview";
import {
  getTemplateSampleValues,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
  WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import { WHATSAPP_TEMPLATE_HEADER_TYPES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mensaje del aviso</DialogTitle>
          <DialogDescription>
            {template ? (
              <>
                Plantilla <span className="break-all font-mono">{template.name}</span>, con datos de
                muestra (no es un pedido real).
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
