"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getTicketById, responderTicket, resolverTicket } from "@/services/superadmin/soporteService";
import { StatusBadge, ESTADO_TICKET_TONE } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

interface Props {
  ticketId: string | null;
  onClose: () => void;
}

export function TicketDetailDrawer({ ticketId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");

  const { data: ticket } = useQuery({
    queryKey: ["superadmin", "ticket", ticketId],
    queryFn: () => getTicketById(ticketId!),
    enabled: !!ticketId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["superadmin", "soporte"] });
    queryClient.invalidateQueries({ queryKey: ["superadmin", "ticket", ticketId] });
  };

  const { mutate: responder, isPending: enviando } = useMutation({
    mutationFn: (txt: string) => responderTicket(ticketId!, txt),
    onSuccess: () => {
      invalidate();
      toast.success("Respuesta enviada.");
      setTexto("");
    },
  });

  const { mutate: resolver, isPending: resolviendo } = useMutation({
    mutationFn: () => resolverTicket(ticketId!),
    onSuccess: () => {
      invalidate();
      toast.success("Ticket marcado como resuelto.");
    },
  });

  return (
    <Sheet open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {ticket && (
          <>
            <SheetHeader>
              <SheetTitle>{ticket.asunto}</SheetTitle>
            </SheetHeader>

            <div className="mt-1 text-xs text-muted-foreground">{ticket.empresaNombre}</div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge label={ticket.estado} tone={ESTADO_TICKET_TONE[ticket.estado]} />
              <span className="text-[11px] text-muted-foreground">
                SLA vence {formatDateTime(ticket.slaVence)}
              </span>
            </div>

            {ticket.estado !== "Resuelto" && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-emerald-600 border-emerald-500/30"
                  disabled={resolviendo}
                  onClick={() => resolver()}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar resuelto
                </Button>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Conversación</div>
              <ul className="space-y-2.5">
                {ticket.mensajes.map((m) => (
                  <li
                    key={m.id}
                    className={cn("flex flex-col", m.esEquipoPowip ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg border px-3 py-2 text-xs",
                        m.esEquipoPowip ? "bg-primary/10 border-primary/20" : "bg-muted/40"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold">{m.autor}</span>
                        {m.esEquipoPowip && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            POWIP
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground">{m.texto}</div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/70">{formatDateTime(m.creadoEn)}</div>
                  </li>
                ))}
                {!ticket.mensajes.length && (
                  <li className="text-xs text-muted-foreground">Sin mensajes todavía.</li>
                )}
              </ul>
            </div>

            <div className="mt-5 rounded-lg border p-3">
              <div className="mb-2 text-xs font-bold">Responder</div>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe tu respuesta…"
                rows={3}
                className="text-xs"
              />
              <Button
                size="sm"
                className="mt-2 gap-1.5"
                disabled={enviando || !texto.trim()}
                onClick={() => responder(texto.trim())}
              >
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
