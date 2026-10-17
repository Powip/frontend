import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Layers,
  Link2,
  MapPin,
  Megaphone,
  Package,
  Store,
  Target,
} from "lucide-react";

export const ADVERTISING_SECTIONS = [
  { label: "Mis números", icon: BarChart3, href: "/publicidad" },
  { label: "Anuncios", icon: Layers, href: "/publicidad/anuncios" },
  { label: "Pruebas", icon: Target, href: "/publicidad/pruebas" },
  { label: "Configuración", icon: Link2, href: "/publicidad/configuracion" },
] as const;

export function advertisingSectionActive(pathname: string, href: string) {
  return pathname === href || (href !== "/publicidad" && pathname.startsWith(`${href}/`));
}

export function advertisingSectionHref(
  href: string,
  from: string,
  to: string,
  filters?: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams({ from, to });
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value) params.set(key, value);
  }
  return `${href}?${params.toString()}`;
}
