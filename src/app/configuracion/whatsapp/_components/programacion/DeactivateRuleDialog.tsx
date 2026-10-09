import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import type { WhatsAppRule } from "@/features/whatsapp/models/rule.model";

const DEACTIVATION_BLOCKED_ID = "deactivate-rule-blocked";

interface DeactivateRuleDialogProps {
  rule: WhatsAppRule | null;
  canPersist: boolean;
  onClose: () => void;
  onDeactivate?: (rule: WhatsAppRule) => void;
}

export function DeactivateRuleDialog({
  rule,
  canPersist,
  onClose,
  onDeactivate,
}: DeactivateRuleDialogProps) {
  const blocked = !canPersist || !onDeactivate;
  return (
    <AlertDialog open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        {rule && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desactivar «{rule.label}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Dejarán de enviarse estos avisos. Qué pasa con los mensajes ya encolados lo define
                el servicio de avisos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {blocked && (
              <p id={DEACTIVATION_BLOCKED_ID} className="text-sm text-muted-foreground">
                La desactivación estará disponible cuando se conecte el servicio de avisos
                automáticos. El aviso sigue como estaba.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <BlockedActionButton
                variant="destructive"
                blocked={blocked}
                blockedReasonId={DEACTIVATION_BLOCKED_ID}
                onClick={() => onDeactivate?.(rule)}
              >
                Desactivar
              </BlockedActionButton>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
