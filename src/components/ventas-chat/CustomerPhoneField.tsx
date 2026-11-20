"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import type { Conversation } from "@/types/crm";
import { CHANNEL_LABEL } from "./format";

/**
 * Teléfono real del cliente en Messenger e Instagram (el canal no lo entrega).
 * Con él se busca o crea el cliente y se vende desde el chat.
 */
export default function CustomerPhoneField({ conversation }: { conversation: Conversation }) {
  const update = useUpdateConversation(conversation.id);
  const saved = conversation.customerPhone?.trim() || null;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved ?? "");
  const digits = value.replace(/\D/g, "");
  const valid = digits.length >= 6 && value.trim().length <= 32;

  const save = () => {
    if (!valid || update.isPending) return;
    update.mutate({ customerPhone: value.trim() }, { onSuccess: () => setEditing(false) });
  };

  if (saved && !editing) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Teléfono del cliente: <b className="text-foreground">{saved}</b>
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(saved);
            setEditing(true);
          }}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {!saved && (
        <p className="text-xs text-muted-foreground">
          Pide el número al cliente para vincularlo. {CHANNEL_LABEL[conversation.channel]} no lo
          entrega.
        </p>
      )}
      <Label htmlFor="customer-phone" className="text-xs">
        Teléfono del cliente
      </Label>
      <div className="flex gap-2">
        <Input
          id="customer-phone"
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+51 999 999 999"
          maxLength={32}
        />
        <Button type="submit" size="sm" disabled={!valid || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />} Guardar
        </Button>
        {saved && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
