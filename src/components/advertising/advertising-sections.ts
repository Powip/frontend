export const ADVERTISING_SECTIONS = [
  { label: "Resumen", href: "/publicidad" },
  { label: "Campañas", href: "/publicidad/campanas" },
  { label: "Anuncios", href: "/publicidad/anuncios" },
  { label: "Resultados", href: "/publicidad/resultados" },
  { label: "Calidad", href: "/publicidad/calidad" },
  { label: "Productos", href: "/publicidad/productos" },
  { label: "Zonas", href: "/publicidad/zonas" },
  { label: "Asignaciones", href: "/publicidad/asignaciones" },
  { label: "Atribución", href: "/publicidad/atribucion" },
  { label: "Alertas", href: "/publicidad/alertas" },
  { label: "Planificador", href: "/publicidad/planificador" },
  { label: "Conexiones", href: "/publicidad/conexiones" },
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
