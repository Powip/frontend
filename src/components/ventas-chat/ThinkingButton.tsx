"use client";
import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types/crm";
import ThinkingDialog from "./ThinkingDialog";

/** Botón «Lo está pensando»: solo en chats abiertos que aún no tienen fecha para retomar. */
export default function ThinkingButton({
  conversation,
  compact = false,
}: {
  conversation: Conversation;
  /** Solo ícono (cabecera del chat); el nombre queda en `aria-label`. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (conversation.status === "closed" || conversation.resumeAt) return null;
  return (
    <>
      {compact ? (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Lo está pensando"
          title="Lo está pensando"
          onClick={() => setOpen(true)}
        >
          <Clock />
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Clock /> Lo está pensando
        </Button>
      )}
      {open && <ThinkingDialog conversation={conversation} onClose={() => setOpen(false)} />}
    </>
  );
}
