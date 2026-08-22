/* -----------------------------------------
   4.1 empresa (negocio cliente)
----------------------------------------- */
export type PlanEmpresa = "Basic" | "Pro" | "Scale" | "Enterprise" | "Trial";

export type EstadoEmpresa = "activo" | "riesgo" | "trial" | "suspendido" | "inactivo";

export type OrigenEmpresa = "lead_sdr" | "web_self_serve" | "partner" | "organico";

export type CanalVenta =
  | "WhatsApp"
  | "Web"
  | "TikTok"
  | "TikTok Live"
  | "Instagram"
  | "Shopify"
  | "Mercado Libre"
  | "Falabella"
  | "Ripley";

export interface IEmpresa {
  id: string;
  nombre: string;
  dominio?: string;
  ruc?: string;
  plan: PlanEmpresa;
  estado: EstadoEmpresa;
  mrr: number;
  healthScore: number;
  canalesVenta: CanalVenta[];
  pedidos30d: number;
  usuariosCount: number;
  ultimoAcceso?: string;
  origen: OrigenEmpresa;
  partnerId?: string;
  partnerCod?: string;
  rubro?: string;
  tipoProductos?: string;
  ltv?: number;
  antiguedadMeses?: number;
  logoIniciales?: string;
  colorAvatar?: string;
  creadoEn: string;
}

/* -----------------------------------------
   4.2 usuario_empresa
----------------------------------------- */
export type RolUsuarioEmpresa = "Administrador" | "Vendedor" | "Soporte";
export type EstadoUsuarioEmpresa = "activo" | "inactivo" | "invitado";

export interface IUsuarioEmpresa {
  id: string;
  empresaId: string;
  empresaNombre: string;
  nombre: string;
  email: string;
  rol: RolUsuarioEmpresa;
  estado: EstadoUsuarioEmpresa;
  registro: string;
  ultimoAcceso?: string;
}

/* -----------------------------------------
   Completitud de datos del negocio (11.1)
----------------------------------------- */
export interface ICompletitudEmpresa {
  catalogo: boolean;
  pedidos: boolean;
  courier: boolean;
  sunat: boolean;
  pagos: boolean;
  canales: boolean;
  pct: number;
}

/* -----------------------------------------
   Perfil 360 — sub-recursos
----------------------------------------- */
export interface IHealthFactor {
  label: string;
  valor: string;
  positivo: boolean;
}

export interface IVentaMensual {
  mes: string;
  gmv: number;
}

export interface IVentaCanal {
  canal: CanalVenta;
  gmv: number;
  pct: number;
}

export interface IPedidoResumen {
  id: string;
  cliente: string;
  monto: number;
  estado: "Entregado" | "En camino" | "Preparando" | "Devuelto" | "Anulado";
  courier: string;
  fecha: string;
}

export interface ISkuResumen {
  sku: string;
  nombre: string;
  stock: number;
  precio: number;
  vendidos30d: number;
}

export interface IComprobanteSunat {
  id: string;
  tipo: "Boleta" | "Factura";
  numero: string;
  monto: number;
  igv: number;
  estado: "Emitido" | "Rechazado" | "Anulado";
  fecha: string;
}

export interface IUpsellOportunidad {
  titulo: string;
  motivo: string;
  mrrPotencial: number;
  caliente: boolean;
}

export interface IIntegracionEmpresa {
  nombre: string;
  conectada: boolean;
  categoria: string;
}
