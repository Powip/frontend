export interface MockUser {
  id: number;
  initials: string;
  color: string;
  user: string;
  name: string;
  surname: string;
  address: string;
  district: string;
  email: string;
  gender: string;
  role: string;
  status: string;
  phone: string;
}

export interface ModuleDefinition {
  name: string;
  iconColor: string;
  routes: string[];
  permissionsCount: number;
}

export interface RolePermissions {
  moduleNames: string[];
  level: "Alto" | "Medio" | "Bajo";
  description: string;
}

export const ALL_MODULES: ModuleDefinition[] = [
  {
    name: "Administración",
    iconColor: "bg-indigo-600",
    routes: [
      "administrar/roles",
      "administrar/rutas",
      "administrar/puntos",
      "administrar/couriers",
      "administrar/zonas",
      "administrar/usuarios",
      "home",
      "logout",
    ],
    permissionsCount: 64,
  },
  {
    name: "Ventas",
    iconColor: "bg-pink-500",
    routes: [
      "ventas/pedidos",
      "ventas/pedido/detalle",
      "ventas/pedido/resumen",
      "ventas/pedidos_items",
      "ventas/preparaciones",
      "ventas/preparaciones_items",
      "ventas/restockaje",
      "ventas/devoluciones",
      "registrar_venta",
    ],
    permissionsCount: 54,
  },
  {
    name: "Estadísticas",
    iconColor: "bg-violet-500",
    routes: ["estadisticas/ventas", "estadisticas/analisis"],
    permissionsCount: 12,
  },
  {
    name: "Finanzas",
    iconColor: "bg-emerald-600",
    routes: [
      "finanzas/dashboard",
      "finanzas/liquidaciones",
      "finanzas/gastos",
    ],
    permissionsCount: 18,
  },
  {
    name: "Operaciones",
    iconColor: "bg-teal-500",
    routes: [
      "operaciones/dashboard",
      "operaciones/gestion",
      "operaciones/guias",
      "operaciones/guia/detalle",
      "operaciones/entregados",
      "operaciones/historial",
    ],
    permissionsCount: 36,
  },
  {
    name: "Stock",
    iconColor: "bg-amber-500",
    routes: [
      "stock/inventario",
      "stock/producto/detalle",
      "stock/proveedores",
      "stock/almacenes",
      "stock/suministros",
      "stock/salidas",
      "stock/inventario_general",
    ],
    permissionsCount: 28,
  },
  {
    name: "Marketing",
    iconColor: "bg-pink-400",
    routes: [
      "marketing/marcas",
      "marketing/modelos",
      "marketing/productos",
      "marketing/categorias",
      "marketing/subcategorias",
    ],
    permissionsCount: 15,
  },
  {
    name: "Contact Center",
    iconColor: "bg-slate-400",
    routes: ["contact_center/administrar", "contact_center/mis_pedidos"],
    permissionsCount: 5,
  },
];

export const TOTAL_ALL_ROUTES = ALL_MODULES.reduce(
  (sum, m) => sum + m.routes.length,
  0,
);
export const TOTAL_ALL_PERMISSIONS = ALL_MODULES.reduce(
  (sum, m) => sum + m.permissionsCount,
  0,
);
export const TOTAL_ALL_MODULES = ALL_MODULES.length;

export const PERMISSIONS_BY_ROLE: Record<string, RolePermissions> = {
  Administrador: {
    moduleNames: ALL_MODULES.map((m) => m.name),
    level: "Alto",
    description: "Acceso completo a todos los módulos del sistema.",
  },
  Ventas: {
    moduleNames: ["Ventas"],
    level: "Medio",
    description: "Acceso a pedidos, clientes y gestión de ventas.",
  },
  Operaciones: {
    moduleNames: ["Operaciones"],
    level: "Medio",
    description: "Acceso a guías, despacho y operaciones logísticas.",
  },
  Marketing: {
    moduleNames: ["Marketing"],
    level: "Bajo",
    description: "Acceso a catálogo de productos y gestión de marcas.",
  },
  "Contact Center": {
    moduleNames: ["Contact Center"],
    level: "Bajo",
    description: "Solo acceso al módulo de atención al cliente.",
  },
  "Atención al cliente": {
    moduleNames: ["Contact Center"],
    level: "Bajo",
    description: "Acceso al módulo de atención al cliente.",
  },
};

export const mockUsers: MockUser[] = [
  {
    id: 1,
    initials: "AG",
    color: "bg-rose-600",
    user: "agarcia",
    name: "Alejandro",
    surname: "García Lozano",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "alejandrogarcialozan8@gma...",
    gender: "Femenino",
    role: "Marketing",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 2,
    initials: "AM",
    color: "bg-teal-500",
    user: "amarcona",
    name: "Alania",
    surname: "marcona",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "alaniamarcona4n@gmail.com",
    gender: "Femenino",
    role: "Ventas",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 3,
    initials: "AA",
    color: "bg-indigo-600",
    user: "aarcotoma",
    name: "Almendra",
    surname: "Arcotoma",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "aflunoa@gmail.com",
    gender: "Femenino",
    role: "Ventas/Operaciones",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 4,
    initials: "CC",
    color: "bg-blue-600",
    user: "ccolla",
    name: "Cristofer",
    surname: "Colla",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "comercial@aranni.com.pe",
    gender: "Masculino",
    role: "Administrador",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 5,
    initials: "CD",
    color: "bg-emerald-600",
    user: "cdelacruz",
    name: "Cecilia",
    surname: "De la Cruz",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "aranipe@gmail.com",
    gender: "Femenino",
    role: "Administrador",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 6,
    initials: "CL",
    color: "bg-purple-600",
    user: "clozano",
    name: "Cesar",
    surname: "Lozano",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "comercial@aranni.com.pe",
    gender: "Masculino",
    role: "Marketing",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 7,
    initials: "CM",
    color: "bg-orange-500",
    user: "cmejia",
    name: "Clara",
    surname: "Mejia",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "clara@gmail.com",
    gender: "Femenino",
    role: "Atención al cliente",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 8,
    initials: "DG",
    color: "bg-teal-600",
    user: "dgil",
    name: "Daniel",
    surname: "Gil",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "danielgildenicanat@gmail.c...",
    gender: "Masculino",
    role: "Ventas",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 9,
    initials: "DH",
    color: "bg-slate-800",
    user: "dhuanca",
    name: "Diana",
    surname: "Huanca",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "administracion@aranni.com...",
    gender: "Femenino",
    role: "Operaciones/Marketing",
    status: "Activo",
    phone: "922720687",
  },
  {
    id: 10,
    initials: "DN",
    color: "bg-rose-700",
    user: "dnunez",
    name: "Diana",
    surname: "Nuñez",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "dnunez@gmail.com",
    gender: "Femenino",
    role: "Marketing",
    status: "Activo",
    phone: "947424308",
  },
  {
    id: 11,
    initials: "WS",
    color: "bg-blue-500",
    user: "eniac321",
    name: "Willia",
    surname: "Sosa",
    address: "Calle 10",
    district: "Distrito",
    email: "eniac32@gmail.com",
    gender: "M",
    role: "Contact Center",
    status: "Inactivo",
    phone: "354600692",
  },
  {
    id: 12,
    initials: "EU",
    color: "bg-orange-600",
    user: "euupo",
    name: "Eduardo",
    surname: "Uupar",
    address: "Jr. Iquique 807 - Breña",
    district: "Breña",
    email: "oparanni@gmail.com",
    gender: "Masculino",
    role: "Operaciones",
    status: "Activo",
    phone: "947424308",
  },
];

export const getRoleColor = (role: string): string => {
  if (role.includes("Marketing")) return "text-pink-600 bg-pink-50";
  if (role.includes("Ventas")) return "text-teal-600 bg-teal-50";
  if (role.includes("Administrador")) return "text-indigo-600 bg-indigo-50";
  if (role.includes("Atención")) return "text-blue-600 bg-blue-50";
  if (role.includes("Operaciones")) return "text-orange-600 bg-orange-50";
  if (role.includes("Contact Center")) return "text-slate-600 bg-slate-100";
  return "text-slate-600 bg-slate-100";
};
