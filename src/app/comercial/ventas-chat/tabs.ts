export interface VentasChatTab {
  label: string;
  href: string;
  /** Solo la ven los administradores (pantallas de supervisor y configuración). */
  adminOnly?: boolean;
}

export const VENTAS_CHAT_TABS: VentasChatTab[] = [
  { label: "Bandeja", href: "/comercial/ventas-chat/bandeja" },
  { label: "Agenda", href: "/comercial/ventas-chat/agenda" },
  { label: "Embudo", href: "/comercial/ventas-chat/embudo" },
  { label: "Seguimientos", href: "/comercial/ventas-chat/seguimientos" },
  { label: "Difusiones", href: "/comercial/ventas-chat/difusiones" },
  { label: "Pau", href: "/comercial/ventas-chat/pau" },
  { label: "Ficha", href: "/comercial/ventas-chat/ficha" },
  { label: "Guion y material", href: "/comercial/ventas-chat/guion", adminOnly: true },
  { label: "Objeciones", href: "/comercial/ventas-chat/objeciones", adminOnly: true },
  { label: "Equipo", href: "/comercial/ventas-chat/equipo", adminOnly: true },
  { label: "Auditoría", href: "/comercial/ventas-chat/auditoria", adminOnly: true },
  { label: "Ajustes", href: "/comercial/ventas-chat/ajustes", adminOnly: true },
];
