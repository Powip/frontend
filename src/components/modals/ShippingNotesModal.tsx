"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { toast } from "sonner";
import { ScrollArea } from "../ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

interface Note {
  user: string;
  date: string;
  text: string;
}

interface ShippingNotesModalProps {
  open: boolean;
  onClose: () => void;
  guideId: string;
  initialNotes?: string; // JSON stringified array
  onNoteAdded: () => void;
}

export default function ShippingNotesModal({
  open,
  onClose,
  guideId,
  initialNotes = "[]",
  onNoteAdded,
}: ShippingNotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { auth } = useAuth();
  const currentUserEmail = auth?.user?.email || "Usuario";

  useEffect(() => {
    try {
      const parsed = JSON.parse(initialNotes || "[]");
      setNotes(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      if (initialNotes) {
        setNotes([{ user: "Sistema", date: new Date().toISOString(), text: initialNotes }]);
      } else {
        setNotes([]);
      }
    }
  }, [initialNotes, open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [notes]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSending(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}`,
        { 
          newNote: newNote.trim(),
          userName: currentUserEmail
        }
      );
      
      toast.success("Comentario agregado");
      setNewNote("");
      onNoteAdded();
    } catch (error: any) {
      toast.error("Error al agregar comentario");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="h-5 w-5 text-primary" />
            Comentarios de la Guía
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          <ScrollArea className="h-full p-6">
            <div className="space-y-4">
              {notes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
                  <MessageSquare className="h-10 w-10 opacity-20" />
                  <p>Sin comentarios aún</p>
                </div>
              ) : (
                notes.map((note, index) => (
                  <div
                    key={index}
                    className={`flex flex-col gap-1 ${
                      note.user === currentUserEmail ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {note.user} • {format(new Date(note.date), "d MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        note.user === currentUserEmail
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-background border rounded-tl-none"
                      }`}
                    >
                      {note.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Escribe un comentario..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              disabled={sending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleAddNote}
              disabled={!newNote.trim() || sending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
