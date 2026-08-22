import {
  LayoutGrid,
  Target,
  Activity,
  Building2,
  TrendingUp,
  PackageSearch,
  Link2,
  Landmark,
  Users,
  RefreshCw,
  FileText,
  ShieldCheck,
  Plug,
  Store,
  Mail,
  Bot,
  LifeBuoy,
  Download,
  ScrollText,
  Settings,
  History,
  type LucideIcon,
} from "lucide-react";
import { RolInterno } from "@/interfaces/superadmin";

export interface SuperadminNavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

/** Orden de sidebar según Sección 5 de la especificación. */
export const SUPERADMIN_NAV: SuperadminNavItem[] = [
  { key: "dashboard", href: "/superadmin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "adquisicion", href: "/superadmin/adquisicion", label: "Adquisición", icon: Target, badge: "Live" },
  { key: "seguimiento", href: "/superadmin/seguimiento", label: "Seguimiento", icon: Activity },
  { key: "empresas", href: "/superadmin/empresas", label: "Empresas", icon: Building2 },
  { key: "oportunidades", href: "/superadmin/oportunidades", label: "Oportunidades", icon: TrendingUp },
  { key: "operacion", href: "/superadmin/operacion", label: "Operación de Red", icon: PackageSearch },
  { key: "partners", href: "/superadmin/partners", label: "Partners", icon: Link2, badge: "Canal" },
  { key: "finanzas", href: "/superadmin/finanzas", label: "Finanzas POWIP", icon: Landmark },
  { key: "usuarios", href: "/superadmin/usuarios", label: "Usuarios", icon: Users },
  { key: "suscripciones", href: "/superadmin/suscripciones", label: "Suscripciones", icon: RefreshCw },
  { key: "facturacion", href: "/superadmin/facturacion", label: "Facturación", icon: FileText },
  { key: "equipo", href: "/superadmin/equipo", label: "Equipo & Permisos", icon: ShieldCheck },
  { key: "integraciones", href: "/superadmin/integraciones", label: "Integraciones", icon: Plug },
  { key: "marketplace", href: "/superadmin/marketplace", label: "Marketplace", icon: Store },
  { key: "campanas", href: "/superadmin/campanas", label: "Campañas", icon: Mail },
  { key: "agentes", href: "/superadmin/agentes", label: "Agentes IA", icon: Bot, badge: "Nuevo" },
  { key: "soporte", href: "/superadmin/soporte", label: "Soporte", icon: LifeBuoy },
  { key: "reportes", href: "/superadmin/reportes", label: "Reportes", icon: Download },
  { key: "logs", href: "/superadmin/logs", label: "Logs del sistema", icon: ScrollText },
  { key: "config", href: "/superadmin/config", label: "Configuración", icon: Settings },
  { key: "auditoria", href: "/superadmin/auditoria", label: "Auditoría", icon: History },
];

/** 3.1 Roles y acceso a módulos. "*" = ve todo. */
export const ROL_VISTAS: Record<RolInterno, string[] | "*"> = {
  super: "*",
  ventas: ["dashboard", "adquisicion", "seguimiento", "partners"],
  soporte: ["dashboard", "soporte", "empresas"],
  onboarding: ["dashboard", "empresas", "seguimiento", "integraciones"],
  finanzas: ["dashboard", "finanzas", "facturacion", "suscripciones"],
  csm: ["dashboard", "seguimiento", "empresas", "oportunidades"],
};

export function navForRole(rol: RolInterno): SuperadminNavItem[] {
  const vistas = ROL_VISTAS[rol];
  if (vistas === "*") return SUPERADMIN_NAV;
  return SUPERADMIN_NAV.filter((item) => vistas.includes(item.key));
}
