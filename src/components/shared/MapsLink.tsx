import type { AnchorHTMLAttributes, ReactNode } from "react";

export function toSafeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Enlace de Google Maps guardado en el cliente (customer.googleMapsUrl), tal
 * como se cargó en la venta. Devuelve la URL completa (solo recortada de
 * espacios) si es http/https válida; null si falta o no es un enlace usable.
 */
export function getGoogleMapsUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !toSafeHttpUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Línea "Google Maps: <enlace>" para los textos que se copian de pedidos.
 * null cuando el pedido no tiene ubicación — el caller omite la línea.
 */
export function formatGoogleMapsClipboardLine(value?: string | null): string | null {
  const url = getGoogleMapsUrl(value);
  return url ? `Google Maps: ${url}` : null;
}

interface MapsLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  url?: string | null;
  fallback?: ReactNode;
}

export function MapsLink({
  url,
  fallback = "-",
  className,
  children = "Ver ubicación",
  ...props
}: MapsLinkProps) {
  const safeUrl = toSafeHttpUrl(url);

  if (!safeUrl) {
    return <>{fallback}</>;
  }

  return (
    <a {...props} href={safeUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
