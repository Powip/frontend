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
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppRule } from "@/features/whatsapp/models/rule.model";
import { cn } from "@/lib/utils";

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
      <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
        {rule && (
          <>
            <AlertDialogHeader className={waDialogHeader}>
              <AlertDialogTitle className={waDialogTitle}>
                ¿Desactivar «{rule.label}»?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className={cn(waDialogBody, "space-y-3")}>
              <AlertDialogDescription className="m-0 text-sm text-wa-muted">
                Dejarán de enviarse estos avisos. Qué pasa con los mensajes ya encolados lo define
                el servicio de avisos.
              </AlertDialogDescription>
              {blocked && (
                <p id={DEACTIVATION_BLOCKED_ID} className="m-0 text-xs text-wa-muted">
                  La desactivación estará disponible cuando se conecte el servicio de avisos
                  automáticos. El aviso sigue como estaba.
                </p>
              )}
            </div>
            <AlertDialogFooter className={waDialogFooter}>
              <AlertDialogCancel className={waButton()}>Cancelar</AlertDialogCancel>
              <BlockedActionButton
                className={waButton({ variant: "solid-danger" })}
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
