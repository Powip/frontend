import {
  Bell,
  CalendarDays,
  ChartColumn,
  FileText,
  Megaphone,
  MessageSquare,
  Package,
  Phone,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface VentasChatTab {
  label: string;
  href: string;
  /** Ícono de la pestaña en el control segmentado (mockup 152). */
  icon: LucideIcon;
  /** Solo la ven los administradores (pantallas de supervisor y configuración). */
  adminOnly?: boolean;
}

export const VENTAS_CHAT_TABS: VentasChatTab[] = [
  { label: "Bandeja", href: "/comercial/ventas-chat/bandeja", icon: MessageSquare },
  { label: "Llamadas", href: "/comercial/ventas-chat/llamadas", icon: Phone },
  { label: "Agenda", href: "/comercial/ventas-chat/agenda", icon: CalendarDays },
  { label: "Embudo", href: "/comercial/ventas-chat/embudo", icon: ChartColumn },
  { label: "Seguimientos", href: "/comercial/ventas-chat/seguimientos", icon: Bell },
  { label: "Difusiones", href: "/comercial/ventas-chat/difusiones", icon: Megaphone },
  { label: "Pau", href: "/comercial/ventas-chat/pau", icon: Sparkles },
  { label: "Ficha", href: "/comercial/ventas-chat/ficha", icon: Package },
  { label: "Ventas", href: "/comercial/ventas-chat/ventas", icon: ShoppingBag },
  { label: "Guion y material", href: "/comercial/ventas-chat/guion", icon: FileText, adminOnly: true },
  { label: "Objeciones", href: "/comercial/ventas-chat/objeciones", icon: TriangleAlert, adminOnly: true },
  { label: "Equipo", href: "/comercial/ventas-chat/equipo", icon: Users, adminOnly: true },
  { label: "Auditoría", href: "/comercial/ventas-chat/auditoria", icon: ShieldCheck, adminOnly: true },
  { label: "Ajustes", href: "/comercial/ventas-chat/ajustes", icon: Settings, adminOnly: true },
];
