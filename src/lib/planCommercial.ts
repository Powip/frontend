import {
  BarChart3,
  Bell,
  Bot,
  Box,
  FileSpreadsheet,
  FileText,
  Globe,
  Headset,
  LayoutGrid,
  Link2,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Plug,
  Radio,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Warehouse,
  DollarSign,
} from "lucide-react";

/** Contenido comercial de "Mi plan y add-ons" (addons.html del equipo comercial). */

/** Pedidos al mes que admite cada plan. Todos los planes traen los mismos módulos. */
export const PLAN_ORDER_CAPS: Record<string, number> = { basic: 999, medium: 1999, standard: 1999, scale: 5999, full: 5999 };

export function planOrderCap(planName: string): number | null {
  const key = planName.toLowerCase().replace(/\s*anual\s*$/, "").trim();
  return PLAN_ORDER_CAPS[key] ?? null;
}

export interface AddOnCard {
  key: string;
  /** Código en el catálogo de ms-subscription; null = todavía no se contrata desde acá. */
  code: string | null;
  name: string;
  icon: LucideIcon;
  where: string;
  /** Precio comercial mensual; si el catálogo trae el código, manda el del catálogo. */
  price: number | null;
  note?: string;
  tag: string;
  bullets: string[];
  roi: string | null;
}

export const ADDON_CARDS: AddOnCard[] = [
  {
    key: "couriers",
    code: "courier",
    name: "Couriers",
    icon: Truck,
    where: "Operaciones › Centro de envíos e Integraciones",
    price: 29,
    tag: "Despacha a Shalom, Olva, Aliclik y EVA desde POWIP, sin subir guías una por una.",
    bullets: [
      "Todos los couriers integrados: Shalom, Olva, Aliclik, EVA y los que se sumen",
      "La guía se genera desde el pedido, sin carga manual en la web del courier",
      "El tracking vuelve solo al pedido y al cliente por WhatsApp",
      "Liquidación de cobranzas por courier",
    ],
    roi: "23 pedidos a Shalom al día son unos 46 minutos de carga manual. Menos de S/ 1 por día.",
  },
  {
    key: "sunat",
    code: "sunat",
    name: "Facturación SUNAT",
    icon: Receipt,
    where: "Finanzas › Facturación SUNAT",
    price: 29,
    note: "Comprobantes ilimitados · boletas, facturas y notas de crédito",
    tag: "Boletas y facturas que se emiten solas cuando confirmas el pedido.",
    bullets: [
      "Boleta o factura emitida al confirmar o entregar el pedido",
      "Notas de crédito por devoluciones",
      "Guías de remisión y reportes listos para tu contador",
      "Comprobantes ilimitados, de tus ventas online y de tu POS",
    ],
    roi: "Se acaba la tarde de fin de mes regularizando ventas una por una.",
  },
  {
    key: "marketplace",
    code: "marketplace",
    name: "Marketplace",
    icon: ShoppingBag,
    where: "Comercial › Ventas multicanal",
    price: null,
    tag: "Conecta Falabella, Ripley y Mercado Libre. Gestiona pedidos de todos en un solo panel.",
    bullets: [],
    roi: null,
  },
  {
    key: "crm",
    code: null,
    name: "CRM chat",
    icon: MessageCircle,
    where: "Comercial › CRM chat",
    price: 79,
    tag: "Tus vendedoras atienden WhatsApp, Instagram y Facebook en una sola bandeja y cierran en 1 minuto.",
    bullets: [
      "Varios números de WhatsApp, Instagram y Facebook en una bandeja",
      'Guion "Venta en 1 minuto" y material de venta a la mano',
      "Pedido y cobro por POWIP Link desde el chat",
      "Llamadas desde el navegador con resumen y objeciones por IA",
    ],
    roi: "Dos ventas más al día con ticket de S/ 80 son S/ 4,800 más al mes, por S/ 79.",
  },
  {
    key: "live",
    code: null,
    name: "POWIP Live",
    icon: Radio,
    where: "Comercial › POWIP Live",
    price: 29,
    tag: "El catálogo de tu live: tus clientes compran, apartan y pagan mientras transmites.",
    bullets: [
      "Catálogo del live con precio live y stock real",
      "Comprar, apartar o acumular desde el link",
      "Pago al instante con Yape o Mercado Pago",
      "Todo lo del mismo live sale en un solo envío",
    ],
    roi: "Una sola venta de S/ 60 en el live ya paga el mes.",
  },
  {
    key: "revendedores",
    code: null,
    name: "POWIP Revendedores",
    icon: Users,
    where: "Comercial › Revendedores",
    price: 29,
    tag: "Revendedoras que venden tu catálogo con su link y cobran comisión cuando el pedido se entrega.",
    bullets: [
      "Cada revendedora con su acceso, su link y su código",
      "Carrito para compartir: arma el pedido y el cliente paga",
      "Comisión liberada al entregar, pagos semanales",
      "La revendedora no ve teléfono, dirección ni DNI del cliente",
    ],
    roi: "Vendes más sin sumar planilla: solo pagas comisión por pedido entregado.",
  },
  {
    key: "pos",
    code: null,
    name: "Punto de Venta",
    icon: Store,
    where: "Menú › Punto de Venta",
    price: 19,
    tag: "Vende en tu tienda física con el mismo stock de tus ventas online. Locales ilimitados.",
    bullets: [
      "Venta de mostrador con lector de código de barras; tus cotizaciones se cobran en caja",
      "Caja con apertura, arqueo y cierre",
      "Locales ilimitados con el mismo inventario",
      "Boleta, factura o nota de venta (con Facturación SUNAT)",
    ],
    roi: "S/ 19 por todos tus locales, no por caja.",
  },
];

/** Add-ons que vienen más adelante: se muestran desactivados. */
export const FUTURE_ADDONS: { key: string; name: string; icon: LucideIcon; where: string; tag: string }[] = [
  {
    key: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    where: "Comercial › WhatsApp",
    tag: "Mensajes y campañas de WhatsApp Business desde POWIP, con tu número verificado.",
  },
  {
    key: "meta-ads",
    name: "Meta Ads",
    icon: Megaphone,
    where: "Publicidad › Meta Ads",
    tag: "Conecta tus campañas de Meta y mide el costo por pedido entregado, sin salir de POWIP.",
  },
];

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const CORE_MODULES: FeatureItem[] = [
  { icon: ShoppingCart, title: "Comercial", text: "Ventas multicanal, registrar venta, clientes, packs y promos" },
  { icon: DollarSign, title: "Ventas COD", text: "Pedidos contra entrega, adelantos, por cobrar y liquidaciones" },
  { icon: Headset, title: "Atención al cliente", text: "Gestión CC: confirmar, llamar, reprogramar y recuperar carritos" },
  { icon: Truck, title: "Operaciones", text: "Centro de envíos, moto propia, registro manual y seguimiento" },
  { icon: Box, title: "Inventario", text: "Stock en tiempo real, SKU madre, compras y proveedores" },
  { icon: Warehouse, title: "Gestión de almacenes", text: "Varios almacenes, traslados, almacén courier y conteos" },
  { icon: BarChart3, title: "Administración", text: "Reporte rápido, utilidad, gastos, flujo de caja y metas" },
  { icon: LayoutGrid, title: "Panel de control", text: "Todo tu negocio en una pantalla, con números reales" },
  {
    icon: Users,
    title: "Usuarios, roles y permisos",
    text: "Tu equipo con acceso por rol; costos y márgenes solo para quien tú decidas",
  },
];

export const FREE_TOOLS: FeatureItem[] = [
  { icon: Link2, title: "POWIP Link", text: "Página del pedido: el cliente confirma y paga" },
  { icon: Globe, title: "Catálogo web", text: "Tu landing de catálogo con checkout" },
  { icon: FileText, title: "Cotizaciones", text: "Cotiza en segundos; el cliente confirma y paga desde su link" },
  { icon: Bell, title: "Notificaciones WhatsApp", text: "Plantillas de despacho y entrega con link de rastreo" },
  { icon: Bot, title: "Confirmación COD con IA", text: "Confirma y cobra el adelanto dentro del Link" },
  { icon: Megaphone, title: "Publicidad", text: "Meta y TikTok Ads: costo por pedido entregado" },
  { icon: ShoppingBag, title: "Shopify", text: "Pedidos y stock sincronizados" },
  { icon: FileSpreadsheet, title: "Importar ventas", text: "Desde Excel o Google Sheets de otro CRM" },
  { icon: Plug, title: "Partners de servicio", text: "Grint, Nihao y Jook por referido" },
];
