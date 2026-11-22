"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
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

export const GRE_NOTICE_POPUP_TITLE =
  "Actualización obligatoria de SUNAT: configura tus credenciales para emitir guías";
export const GRE_NOTICE_POPUP_BODY =
  "Para enviar guías de remisión electrónicas y pasar las validaciones de SUNAT, cada RUC debe cargar sus credenciales GRE (client_id y client_secret de SOL) en Facturación › Certificado Digital.";
export const GRE_NOTICE_POPUP_SUPPORT =
  "¿Necesitas ayuda? Comunícate con tu grupo de soporte para configurar tus credenciales y guías.";
export const GRE_NOTICE_BOX_TEXT =
  "Actualización obligatoria de SUNAT: configura tus credenciales GRE en Facturación › Certificado Digital para emitir guías. Ayuda: tu grupo de soporte.";
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
              {GRE_NOTICE_POPUP_TITLE}
            </DialogTitle>
            <DialogDescription>{GRE_NOTICE_POPUP_BODY}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{GRE_NOTICE_POPUP_SUPPORT}</p>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {boxMounted ? (
        <div
          role="status"
          data-testid="gre-credentials-box"
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-lg transition-opacity duration-500 dark:border-amber-900 dark:bg-amber-950 ${
            boxFading ? "opacity-0" : "opacity-100"
          }`}
        >
          {GRE_NOTICE_BOX_TEXT}
        </div>
      ) : null}
    </>
  );
}
