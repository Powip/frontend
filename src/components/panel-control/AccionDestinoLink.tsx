import Link from "next/link";
import type { ReactNode } from "react";
import type { DestinoAccion } from "@/features/panel-control/acciones/utils/destino-accion";

interface Props {
  destino: DestinoAccion;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}

/** Enlace de una acción: pantalla existente (misma pestaña) o WhatsApp (pestaña nueva). */
export function AccionDestinoLink({ destino, ariaLabel, className, children }: Props) {
  if (destino.tipo === "whatsapp") {
    return (
      <a
        href={destino.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={destino.href} aria-label={ariaLabel} className={className}>
      {children}
    </Link>
  );
}
