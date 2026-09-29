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
