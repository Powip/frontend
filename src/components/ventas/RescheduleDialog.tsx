"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (callbackAt: Date) => void;
}

function defaultCallbackDatetimeLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  onConfirm,
}: RescheduleDialogProps) {
  const [dateValue, setDateValue] = useState(defaultCallbackDatetimeLocal);

  const handleConfirm = () => {
    onConfirm(new Date(dateValue));
    onOpenChange(false);
    setDateValue(defaultCallbackDatetimeLocal());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Programar callback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Por defecto: hoy + 24 hs. Modificalo si necesitás otra fecha.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date" className="text-xs font-medium">
              Fecha y hora del callback
            </Label>
            <Input
              id="reschedule-date"
              type="datetime-local"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8"
              onClick={handleConfirm}
              disabled={!dateValue}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
