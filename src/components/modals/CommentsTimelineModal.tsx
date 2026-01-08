"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Clock, User, Settings, MessageCircle } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface LogEntry {
  id: number;
  orderId: string;
  comentarios: string | null;
  operacion: string;
  timestamp: string;
  userId: string | null;
  userName?: string | null;
  isSystemGenerated?: boolean;
}

interface CommentsTimelineModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
}

const OPERACION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  CREATE_ORDER_HEADER: "Orden creada",
  CREATE_ORDER_WITH_ITEMS: "Orden con items creada",
  ADD_ORDER_ITEM: "Item agregado",
  REMOVE_ORDER_ITEM: "Item eliminado",
  UPDATE: "Actualización",
  REVERSE_PAYMENT: "Pago reversado",
  HARDDELETED: "Eliminado",
  REACTIVATE: "Reactivado",
  INACTIVATE: "Inactivado",
  COURIER_ASSIGNED: "Courier asignado",
  COMMENT: "Comentario",
};

export default function CommentsTimelineModal({
  open,
  onClose,
  orderId,
  orderNumber,
}: CommentsTimelineModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { auth } = useAuth();

  const fetchLogs = async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    try {
      const res = await axios.get<LogEntry[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas/${orderId}`
      );
      setLogs(res.data);
    } catch (error) {
      console.error("Error cargando historial", error);
      toast.error("Error al cargar el historial");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && orderId) {
      fetchLogs();
    }
  }, [open, orderId]);

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setIsSending(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas`, {
        orderId,
        comentarios: newComment.trim(),
        operacion: "COMMENT",
        userId: auth?.user?.id ?? null,
        userName: auth?.user?.email ?? null, 
        data: {},
        isSystemGenerated: false,
      });
      setNewComment("");
      fetchLogs();
    } catch (error) {
      console.error("Error enviando comentario", error);
      toast.error("Error al enviar el comentario");
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleClose = () => {
    setNewComment("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Historial - Orden #{orderNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Cargando historial...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay registros en el historial
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className={`relative pl-6 pb-4 ${
                    index < logs.length - 1 ? "border-l-2 border-muted ml-2" : "ml-2"
                  }`}
                >
                  {/* Dot */}
                  <div
                    className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      log.isSystemGenerated
                        ? "bg-muted border-muted-foreground"
                        : "bg-primary border-primary"
                    }`}
                  >
                    {log.isSystemGenerated ? (
                      <Settings className="h-2 w-2 text-muted-foreground" />
                    ) : (
                      <MessageCircle className="h-2 w-2 text-primary-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`rounded-lg p-3 ${log.isSystemGenerated ? 'bg-muted/30 border border-muted' : 'bg-primary/10 border border-primary/20'}`}>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(log.timestamp)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${log.isSystemGenerated ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                          {log.isSystemGenerated ? (
                            <><Settings className="h-3 w-3" /> Sistema</>
                          ) : (
                            <><MessageCircle className="h-3 w-3" /> {OPERACION_LABELS[log.operacion] || log.operacion}</>
                          )}
                        </span>
                        {log.isSystemGenerated && (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-xs">
                            {OPERACION_LABELS[log.operacion] || log.operacion}
                          </span>
                        )}
                      </div>
                      {/* Nombre del usuario */}
                      {log.userName && (
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                          <User className="h-3 w-3" />
                          <span>{log.userName}</span>
                        </div>
                      )}
                    </div>
                    {log.comentarios && (
                      <p className="text-sm mt-1">{log.comentarios}</p>
                    )}
                    {!log.comentarios && log.isSystemGenerated && (
                      <p className="text-sm text-muted-foreground italic">
                        Acción automática del sistema
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input para nuevo comentario */}
        <div className="border-t pt-4 mt-4">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              className="flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
            />
            <Button
              onClick={handleSendComment}
              disabled={!newComment.trim() || isSending}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Presiona Enter para enviar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
