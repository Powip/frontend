"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSheets } from "@/hooks/useCrmContent";
import { cn } from "@/lib/utils";
import { crmContentError, listChatTestimonies, saveChatTestimony } from "@/services/crmContentService";
import type { Message } from "@/types/crm";
import { NATIVE_SELECT_CLASS } from "./format";

export const chatTestimonyKey = (conversationId: string) => ["crm", "content", "chat-testimonies", conversationId] as const;

/** Solo fotos que mandó el cliente por WhatsApp (las que el CRM puede copiar a su almacenamiento). */
export function canSaveAsTestimony(m: Pick<Message, "direction" | "mediaMime">): boolean {
  return m.direction === "in" && /^image\/(jpeg|png|webp)$/i.test(m.mediaMime ?? "");
}

/**
 * «Guardar como testimonio» bajo una foto del cliente (mockup 152). El supervisor
 * publica directo; la vendedora la deja por aprobar en Guion.
 */
export default function SaveTestimonyButton({ message }: { message: Message }) {
  const qc = useQueryClient();
  const marks = useQuery({
    queryKey: chatTestimonyKey(message.conversationId),
    queryFn: () => listChatTestimonies(message.conversationId),
    retry: false,
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [title, setTitle] = useState("");
  const sheets = useSheets("", open);
  const save = useMutation({
    mutationFn: () => saveChatTestimony(message.conversationId, message.id, { sheetId, title: title.trim() }),
    onSuccess: (m) => {
      toast.success(m.status === "pending" ? "Enviado al supervisor para aprobar" : "Guardado en Testimonios");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["crm", "content"] });
    },
    onError: (err) => toast.error(crmContentError(err).message),
  });

  const mark = marks.data?.find((x) => x.messageId === message.id);
  if (mark) {
    return mark.status === "pending" ? (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
        Testimonio por aprobar
      </Badge>
    ) : (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
        Guardado en Testimonios
      </Badge>
    );
  }

  const activeSheets = (sheets.data ?? []).filter((s) => s.active);
  const canSave = !!sheetId && !!title.trim() && !save.isPending;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs text-foreground"
        onClick={() => {
          setTitle(message.mediaName?.replace(/\.[^.]+$/, "") || "Foto de clienta");
          setOpen(true);
        }}
      >
        <Star /> Guardar como testimonio
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar como testimonio</DialogTitle>
            <DialogDescription>
              La foto queda en Testimonios del producto. Si no eres supervisora, queda por aprobar en Guion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`tes-sheet-${message.id}`}>Producto</Label>
              <select
                id={`tes-sheet-${message.id}`}
                className={cn(NATIVE_SELECT_CLASS, "h-9 w-full text-sm")}
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
              >
                <option value="">{sheets.isLoading ? "Cargando…" : "Elige el producto"}</option>
                {activeSheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!sheets.isLoading && activeSheets.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay fichas de producto. Créalas en Ficha de venta.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tes-title-${message.id}`}>Título</Label>
              <Input
                id={`tes-title-${message.id}`}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!canSave} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Star />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
