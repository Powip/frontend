import type {
  PanelSubtabId,
  PanelTabDefinition,
  PanelTabId,
} from "../models/panel-navigation.model";

export const PANEL_TABS: PanelTabDefinition[] = [
  {
    id: "resumen",
    label: "Resumen",
    mobileLabel: "Inicio",
    titulo: "Resumen",
    subtitulo: "Cómo va el negocio y qué hay que hacer hoy",
    moduloRelacionado: null,
    subtabs: [],
  },
  {
    id: "canales",
    label: "Ventas y canales",
    mobileLabel: "Ventas",
    titulo: "Ventas y canales",
    subtitulo: "Cada canal contabilizado según su ficha de reglas",
    moduloRelacionado: { label: "Ventas", href: "/ventas" },
    subtabs: [
      { id: "canales", label: "Canales" },
      { id: "productos", label: "Productos" },
      { id: "publicidad", label: "Publicidad" },
      { id: "clientes", label: "Clientes y zonas" },
    ],
  },
  {
    id: "callcenter",
    label: "Call center",
    mobileLabel: "Llamadas",
    titulo: "Call center",
    subtitulo: "Confirmación de leads · un lead es venta solo cuando la confirmadora lo confirma",
    moduloRelacionado: { label: "Call Center", href: "/atencion-cliente" },
    subtabs: [],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    mobileLabel: "Pedidos",
    titulo: "Operaciones",
    subtitulo: "La cola de hoy, los couriers y el stock",
    moduloRelacionado: { label: "Pedidos", href: "/operaciones/pedidos" },
    subtabs: [
      { id: "cola", label: "Cola y tiempos" },
      { id: "couriers", label: "Couriers" },
      { id: "inventario", label: "Inventario" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    mobileLabel: "Finanzas",
    titulo: "Finanzas",
    subtitulo: "Facturado no es cobrado",
    moduloRelacionado: { label: "Finanzas", href: "/finanzas" },
    subtabs: [
      { id: "resultado", label: "Resultado (por fecha del pedido)" },
      { id: "caja", label: "Caja (por fecha del dinero)" },
      { id: "cobranza", label: "Cobranza" },
    ],
  },
  {
    id: "equipo",
    label: "Equipo",
    mobileLabel: "Equipo",
    titulo: "Equipo",
    subtitulo: "Vendedoras y confirmadoras se miden distinto",
    moduloRelacionado: null,
    subtabs: [
      { id: "vendedoras", label: "Vendedoras y caja" },
      { id: "confirmadoras", label: "Confirmadoras" },
    ],
  },
  {
    id: "misventas",
    label: "Mis ventas",
    mobileLabel: "Mis ventas",
    titulo: "Mis ventas",
    subtitulo: "Tu avance del periodo",
    moduloRelacionado: { label: "Ventas", href: "/ventas" },
    subtabs: [],
  },
  {
    id: "configuracion",
    label: "Configuración",
    mobileLabel: "Ajustes",
    titulo: "Configuración",
    subtitulo: "Canales, metas, reglas y cuadres",
    moduloRelacionado: null,
    subtabs: [
      { id: "canales", label: "Canales" },
      { id: "metas", label: "Metas" },
      { id: "estados", label: "Estados y reglas" },
      { id: "cuadres", label: "Cuadres y calidad" },
      { id: "desarrollo", label: "Para desarrollo" },
    ],
  },
];

export function getTabDefinition(tab: PanelTabId): PanelTabDefinition {
  const found = PANEL_TABS.find((definition) => definition.id === tab);
  if (!found) {
    throw new Error(`Pestaña desconocida: ${tab}`);
  }
  return found;
}

export function getDefaultSubtab(tab: PanelTabId): PanelSubtabId | null {
  return getTabDefinition(tab).subtabs[0]?.id ?? null;
}

export function isSubtabOf(tab: PanelTabId, subtab: string | null): subtab is PanelSubtabId {
  if (!subtab) return false;
  return getTabDefinition(tab).subtabs.some((definition) => definition.id === subtab);
}
