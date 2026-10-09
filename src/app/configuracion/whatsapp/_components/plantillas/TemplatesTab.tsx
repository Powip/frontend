"use client";

import { useRef, useState } from "react";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { TemplateEditorDialog, type TemplateEditorMode } from "./TemplateEditorDialog";
import { type TemplateApprovedNotice, TemplatesListView } from "./TemplatesListView";

const PENDING_TEMPLATES: WhatsAppResourceState<WhatsAppTemplate[]> = {
  kind: "pending-integration",
};

interface TemplatesTabProps {
  canManage: boolean;
  businessName: string;
  onActivateRule?: (template: WhatsAppTemplate) => void;
}

export function buildApprovedNotice(
  template: WhatsAppTemplate | null,
  options: {
    canActivateRule: boolean;
    onActivateRule?: (template: WhatsAppTemplate) => void;
    onDismiss: () => void;
  },
): TemplateApprovedNotice | null {
  if (!template) return null;
  return {
    templateName: template.name,
    canActivateRule: options.canActivateRule && !!options.onActivateRule,
    onActivateRule: () => options.onActivateRule?.(template),
    onDismiss: options.onDismiss,
  };
}

export function TemplatesTab({ canManage, businessName, onActivateRule }: TemplatesTabProps) {
  const sessionCounter = useRef(0);
  const [editorSession, setEditorSession] = useState<{
    key: number;
    mode: TemplateEditorMode;
  } | null>(null);
  const [approvedTemplate, setApprovedTemplate] = useState<WhatsAppTemplate | null>(null);

  const openEditor = (mode: TemplateEditorMode) => {
    sessionCounter.current += 1;
    setEditorSession({ key: sessionCounter.current, mode });
  };

  return (
    <>
      <TemplatesListView
        state={PENDING_TEMPLATES}
        canManage={canManage}
        onCreate={() => openEditor({ kind: "new" })}
        onEdit={(template) => openEditor({ kind: "edit", template })}
        onDuplicate={(template) => openEditor({ kind: "duplicate", template })}
        approvedNotice={buildApprovedNotice(approvedTemplate, {
          canActivateRule: canManage,
          onActivateRule,
          onDismiss: () => setApprovedTemplate(null),
        })}
      />
      {editorSession && (
        <TemplateEditorDialog
          key={editorSession.key}
          open
          mode={editorSession.mode}
          businessName={businessName}
          canManage={canManage}
          canPersist={isWhatsAppContractAvailable("templates")}
          onClose={() => setEditorSession(null)}
        />
      )}
    </>
  );
}
