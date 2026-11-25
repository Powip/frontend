"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { EmbeddedSignupConfig } from "@/types/crmTeam";

interface Props {
  /** Prefijo de los data-testid: `embedded-signup` (WhatsApp) o `meta-login` (Instagram y Messenger). */
  testId: string;
  /** Qué hace la persona en la ventana de Meta. */
  help: ReactNode;
  config: EmbeddedSignupConfig | null;
  configError: string | null;
  /** Variables que se muestran si el servidor no dice cuáles faltan. */
  fallbackMissing: string[];
  busy: boolean;
  disabled?: boolean;
  onConnect: () => void;
}

/**
 * Recuadro «Conectar con Facebook» que comparten WhatsApp, Instagram y Messenger:
 * mismo texto, mismo aviso de lo que falta en el servidor y mismo botón.
 */
export default function ConnectWithFacebookBox({
  testId,
  help,
  config,
  configError,
  fallbackMissing,
  busy,
  disabled,
  onConnect,
}: Props) {
  const missing = config?.missing?.length ? config.missing : fallbackMissing;
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid={testId}>
      <p className="text-xs font-medium">Conectar con Facebook</p>
      <p className="text-xs text-muted-foreground">{help}</p>
      {config && !config.enabled && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-disabled`}>
          Falta configurar la app de Meta en el servidor ({missing.join(", ")}). Mientras tanto usa
          los datos manuales.
        </p>
      )}
      {configError && (
        <p className="text-xs text-destructive">No se pudo leer la configuración: {configError}</p>
      )}
      {config?.simulated && (
        <p className="text-xs text-muted-foreground">Modo simulador local: no se abre Meta.</p>
      )}
      <Button type="button" onClick={onConnect} disabled={!config?.enabled || busy || disabled}>
        {busy ? "Conectando…" : "Conectar con Facebook"}
      </Button>
    </div>
  );
}
