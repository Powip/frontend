"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { crmKeys } from "@/lib/crmSse";
import { crmError, sendImageMessage } from "@/services/crmService";
import type { Message, MessagePage } from "@/types/crm";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CAPTION_MAX = 1024;

/** Motivo para no aceptar el archivo, o null si se puede enviar. */
export function imageProblem(file: Pick<File, "type" | "size">): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Solo se envían fotos JPG, PNG o WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "La foto pesa más de 5 MB.";
  return null;
}

/** Botón del chat de WhatsApp para enviar una foto con pie opcional. */
export function SendImageButton({
  conversationId,
  disabled,
}: {
  conversationId: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const close = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
  };

  const send = useMutation({
    mutationFn: () => sendImageMessage(conversationId, file as File, caption),
    onSuccess: (real: Message) => {
      qc.setQueryData<MessagePage>(crmKeys.messages(conversationId), (old) =>
        old && !old.items.some((m) => m.id === real.id) ? { ...old, items: [...old.items, real] } : old,
      );
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
      qc.invalidateQueries({ queryKey: crmKeys.conversation(conversationId) });
      toast.success("Foto enviada");
      close();
    },
    onError: (err) => toast.error(crmError(err).message),
  });

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        data-testid="send-image-input"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (!chosen) return;
          const problem = imageProblem(chosen);
          if (problem) {
            toast.error(problem);
            return;
          }
          setFile(chosen);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => input.current?.click()}
        aria-label="Enviar foto"
        title="Enviar foto"
      >
        <ImagePlus />
      </Button>
      <Dialog open={!!file} onOpenChange={(open) => !open && !send.isPending && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar foto</DialogTitle>
            <DialogDescription>El cliente la recibe por WhatsApp con el texto que escribas abajo.</DialogDescription>
          </DialogHeader>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={file?.name ?? "Foto"} className="max-h-72 w-full rounded-md object-contain" />
          )}
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
            rows={2}
            placeholder="Pie de foto (opcional)"
            aria-label="Pie de foto"
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={send.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending}>
              {send.isPending && <Loader2 className="animate-spin" />}
              Enviar foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
