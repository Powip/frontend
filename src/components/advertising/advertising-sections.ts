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
  { label: "Resumen", icon: BarChart3, href: "/publicidad" },
  { label: "Campañas", icon: Megaphone, href: "/publicidad/campanas" },
  { label: "Asignaciones", icon: Store, href: "/publicidad/asignaciones" },
  { label: "Anuncios", icon: Layers, href: "/publicidad/anuncios" },
  { label: "Resultados", icon: CircleDollarSign, href: "/publicidad/resultados" },
  { label: "Calidad", icon: CheckCheck, href: "/publicidad/calidad" },
  { label: "Productos", icon: Package, href: "/publicidad/productos" },
  { label: "Zonas", icon: MapPin, href: "/publicidad/zonas" },
  { label: "Atribución", icon: Target, href: "/publicidad/atribucion" },
  { label: "Alertas", icon: Bell, href: "/publicidad/alertas" },
  { label: "Planificador", icon: CalendarDays, href: "/publicidad/planificador" },
  { label: "Conexiones", icon: Link2, href: "/publicidad/conexiones" },
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
