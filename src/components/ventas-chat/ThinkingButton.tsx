"use client";
import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types/crm";
import ThinkingDialog from "./ThinkingDialog";

/** Botón «Lo está pensando»: solo en chats abiertos que aún no tienen fecha para retomar. */
export default function ThinkingButton({ conversation }: { conversation: Conversation }) {
  const [open, setOpen] = useState(false);
  if (conversation.status === "closed" || conversation.resumeAt) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Clock /> Lo está pensando
      </Button>
      {open && <ThinkingDialog conversation={conversation} onClose={() => setOpen(false)} />}
    </>
  );
}
