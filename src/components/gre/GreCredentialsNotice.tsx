"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { SUPPORT_WHATSAPP_URL } from "@/app/configuracion/_components/HelpSection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGreSettings } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type { GreSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";

// Aviso para empresas con RUC de facturación pero sin credenciales GRE/SUNAT.
// Pop-up una vez por sesión al entrar + recuadro que reaparece cada 60 s y se
// desvanece a los 4 s. Los textos viven aquí para ajustarlos en un solo lugar.

export const GRE_NOTICE_TITLE = "Falta configurar tus credenciales SUNAT para emitir guías";
export const GRE_NOTICE_SUPPORT =
  "Comunícate con el grupal de soporte para recibir apoyo en la configuración de credenciales y guías.";
export const GRE_NOTICE_UPDATE =
  "Actualización obligatoria de SUNAT: cambió el envío de guías de remisión y sus validaciones.";
export const GRE_NOTICE_SESSION_KEY = "powip:gre-credentials-popup-shown";
export const GRE_NOTICE_INTERVAL_MS = 60_000;
export const GRE_NOTICE_VISIBLE_MS = 4_000;
const FADE_MS = 500;

/** true si hay RUC activos y alguno no tiene credenciales GRE cargadas. */
export function missingGreCredentials(settings: GreSettings | undefined): boolean {
  if (!settings) return false;
  const active = settings.profiles.filter((profile) => profile.isActive);
  return active.length > 0 && active.some((profile) => !profile.configured);
}

function NoticeText() {
  return (
    <>
      <p>{GRE_NOTICE_TITLE}.</p>
      <p>{GRE_NOTICE_UPDATE}</p>
      <p>{GRE_NOTICE_SUPPORT}</p>
    </>
  );
}

export default function GreCredentialsNotice() {
  const settings = useGreSettings();
  const missing = missingGreCredentials(settings.data);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boxMounted, setBoxMounted] = useState(false);
  const [boxFading, setBoxFading] = useState(false);

  useEffect(() => {
    if (!missing) return;
    try {
      if (window.sessionStorage.getItem(GRE_NOTICE_SESSION_KEY)) return;
      window.sessionStorage.setItem(GRE_NOTICE_SESSION_KEY, "1");
    } catch {
      // sin sessionStorage: se muestra igual, una vez por montaje
    }
    setDialogOpen(true);
  }, [missing]);

  useEffect(() => {
    if (!missing) {
      setBoxMounted(false);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const interval = setInterval(() => {
      setBoxFading(false);
      setBoxMounted(true);
      timers.push(setTimeout(() => setBoxFading(true), GRE_NOTICE_VISIBLE_MS - FADE_MS));
      timers.push(setTimeout(() => setBoxMounted(false), GRE_NOTICE_VISIBLE_MS));
    }, GRE_NOTICE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [missing]);

  if (!missing) return null;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
              {GRE_NOTICE_TITLE}
            </DialogTitle>
            <DialogDescription>{GRE_NOTICE_UPDATE}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{GRE_NOTICE_SUPPORT}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Entendido
            </Button>
            <Button asChild>
              <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Contactar soporte
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {boxMounted ? (
        <div
          role="status"
          data-testid="gre-credentials-box"
          className={`fixed bottom-4 right-4 z-50 max-w-sm space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-lg transition-opacity duration-500 dark:border-amber-900 dark:bg-amber-950 ${
            boxFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <NoticeText />
        </div>
      ) : null}
    </>
  );
}
