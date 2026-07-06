import Link from "next/link";
import {
  ArrowLeft,
  Edit2,
  Shield,
  Folder,
  LayoutGrid,
  Eye,
  Check,
  Calendar,
  User,
  AlignLeft,
  Info,
  MessageSquare,
  Headphones,
  Truck,
  Users,
  ChevronDown,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rolesData: Record<string, any> = {
  operaciones: {
    title: "Operaciones",
    icon: Truck,
    iconBg: "bg-orange-100 text-orange-600",
    description: "Gestión de guías, despachos y couriers.",
    status: "Activo",
    isSystemPosition: true,
    tabs: [
      "Resumen",
      "Permisos y vistas",
      "Colaboradores (2)",
      "Historial de cambios",
    ],
    activeTab: "Resumen",
    stats: {
      modules: { count: 1, total: 6 },
      routes: { count: 9, total: 58 },
      permissions: { count: 36, total: 232 },
      level: {
        title: "Operativo",
        desc: "Acceso a las funciones operativas del área de operaciones.",
      },
    },
    modules: [
      {
        name: "Operaciones",
        icon: Truck,
        iconBg: "bg-emerald-500",
        level: "Operativo",
        levelColor: "bg-blue-50 text-blue-600",
        routes: "9 / 9",
        permissions: "36 / 36",
        views: "Guías, Despachos, Couriers, Zonas, Operadores",
      },
    ],
    routesList: [
      {
        route: "operaciones/guias",
        desc: "Listado y gestión de guías",
        perm: "6 permisos",
        access: true,
      },
      {
        route: "operaciones/guias/detalle",
        desc: "Detalle de guía y seguimiento",
        perm: "6 permisos",
        access: true,
      },
      {
        route: "operaciones/despachos",
        desc: "Gestión de despachos",
        perm: "5 permisos",
        access: true,
      },
      {
        route: "operaciones/couriers",
        desc: "Gestión de couriers",
        perm: "5 permisos",
        access: true,
      },
      {
        route: "operaciones/zonas",
        desc: "Gestión de zonas de reparto",
        perm: "4 permisos",
        access: true,
      },
      {
        route: "operaciones/operadores",
        desc: "Gestión de operadores",
        perm: "4 permisos",
        access: true,
      },
    ],
    routesCount: 9,
    additionalInfo: null,
  },
  ventas: {
    title: "Ventas",
    icon: MessageSquare,
    iconBg: "bg-pink-100 text-pink-600",
    description: "Gestión de pedidos, clientes y ventas.",
    status: "Activo",
    isSystemPosition: false,
    tabs: [
      "Resumen",
      "Permisos y vistas",
      "Colaboradores (3)",
      "Historial de cambios",
    ],
    activeTab: "Permisos y vistas",
    stats: {
      modules: { count: 2, total: 6 },
      routes: { count: 10, total: 58 },
      permissions: { count: 48, total: 232 },
      level: {
        title: "Operativo",
        desc: "Acceso a funciones operativas del área de ventas.",
      },
    },
    modules: [
      {
        name: "Ventas",
        icon: MessageSquare,
        iconBg: "bg-pink-500",
        level: "Total",
        levelColor: "bg-emerald-50 text-emerald-600",
        routes: "10 / 10",
        permissions: "48 / 48",
        views: "Pedidos, Clientes, Productos, Devoluciones, Reportes",
      },
      {
        name: "Contact Center",
        icon: Headphones,
        iconBg: "bg-purple-400",
        level: "Parcial",
        levelColor: "bg-amber-50 text-amber-600",
        routes: "2 / 3",
        permissions: "12 / 18",
        views: "Conversaciones, Tickets, Plantillas",
      },
      {
        name: "Marketing",
        icon: Megaphone,
        iconBg: "bg-orange-500",
        level: "Limitado",
        levelColor: "bg-slate-100 text-slate-600",
        routes: "1 / 7",
        permissions: "4 / 28",
        views: "Catálogo de productos",
      },
    ],
    routesList: [
      {
        route: "ventas/pedidos",
        module: "Ventas",
        moduleBg: "bg-pink-500",
        moduleIcon: MessageSquare,
        desc: "Listado y gestión de pedidos",
        perm: "8 permisos",
        access: null,
      },
      {
        route: "ventas/clientes",
        module: "Ventas",
        moduleBg: "bg-pink-500",
        moduleIcon: MessageSquare,
        desc: "Listado y gestión de clientes",
        perm: "6 permisos",
        access: null,
      },
      {
        route: "ventas/devoluciones",
        module: "Ventas",
        moduleBg: "bg-pink-500",
        moduleIcon: MessageSquare,
        desc: "Gestión de devoluciones y reclamos",
        perm: "4 permisos",
        access: null,
      },
      {
        route: "ventas/preparaciones",
        module: "Ventas",
        moduleBg: "bg-pink-500",
        moduleIcon: MessageSquare,
        desc: "Preparaciones de pedidos y picking",
        perm: "6 permisos",
        access: null,
      },
      {
        route: "ventas/reportes",
        module: "Ventas",
        moduleBg: "bg-pink-500",
        moduleIcon: MessageSquare,
        desc: "Reportes de ventas",
        perm: "4 permisos",
        access: null,
      },
    ],
    routesCount: 10,
    additionalInfo: null,
  },
  "contact-center": {
    title: "Contact Center",
    icon: Headphones,
    iconBg: "bg-indigo-100 text-indigo-600",
    description: "Solo acceso al módulo de atención al cliente.",
    status: "Activo",
    isSystemPosition: true,
    tabs: [
      "Resumen",
      "Permisos y vistas",
      "Colaboradores (1)",
      "Historial de cambios",
    ],
    activeTab: "Resumen",
    stats: {
      modules: { count: 1, total: 6 },
      routes: { count: 3, total: 58 },
      permissions: { count: 18, total: 232 },
      level: {
        title: "Parcial",
        desc: "Acceso limitado al módulo de atención al cliente.",
      },
    },
    modules: [
      {
        name: "Contact Center",
        icon: Headphones,
        iconBg: "bg-indigo-500",
        level: "Parcial",
        levelColor: "bg-amber-50 text-amber-600",
        routes: "3 / 3",
        permissions: "18 / 18",
        views: "Conversaciones, Tickets, Plantillas",
      },
    ],
    routesList: [
      {
        route: "contact-center/ventas-pedidos-cod",
        desc: "Atiende consultas y ventas de pedidos COD.",
        perm: "8 permisos",
        access: true,
      },
      {
        route: "contact-center/confirmacion-envios",
        desc: "Gestiona confirmaciones de envíos con clientes.",
        perm: "6 permisos",
        access: true,
      },
      {
        route: "contact-center/envios-a-ruta",
        desc: "Asigna y confirma envíos a ruta (reparto).",
        perm: "4 permisos",
        access: true,
      },
    ],
    routesCount: 3,
    additionalInfo: {
      users: 1,
      created: "12 may, 2024",
      updated: "20 may, 2024",
      desc: "Solo acceso al módulo de atención al cliente para gestionar consultas, pedidos y envíos.",
    },
  },
};

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = rolesData[id] || rolesData["operaciones"];
  const Icon = data.icon;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center text-sm text-indigo-700 font-medium mb-6 cursor-pointer hover:underline">
          <Link
            href="/administracion/usuarios?tab=roles"
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Volver a posiciones
          </Link>
        </div>

        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm ${data.iconBg}`}
            >
              <Icon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">
                {data.title}
              </h1>
              <p className="text-sm text-slate-500 mb-2">{data.description}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  {data.status}
                </div>
                {data.isSystemPosition && (
                  <div className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                    <User className="w-3 h-3 inline-block mr-1" />
                    Posición del sistema
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar posición
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400">
              <span className="sr-only">More</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
              >
                <path
                  d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                ></path>
              </svg>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-8">
          {data.tabs.map((tab: string) => (
            <div
              key={tab}
              className={`relative pb-3 font-semibold cursor-pointer ${
                data.activeTab === tab
                  ? "text-indigo-700 border-b-2 border-indigo-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6  w-full ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-indigo-600 text-white flex-shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Módulos con acceso
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.stats.modules.count}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                de {data.stats.modules.total} módulos disponibles
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-500 text-white flex-shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Rutas con acceso
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.stats.routes.count}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                de {data.stats.routes.total} rutas disponibles
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-500 text-white flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Permisos asignados
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.stats.permissions.count}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                de {data.stats.permissions.total} permisos posibles
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-amber-500 text-white flex-shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Nivel de acceso
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.stats.level.title}
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-tight">
                {data.stats.level.desc}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Acceso por módulo</h3>
            <p className="text-sm text-slate-500">
              Resumen de módulos y nivel de acceso asignado a esta posición.
            </p>
          </div>
          <div className="p-2">
            <Table>
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider w-[250px]">
                    MÓDULO
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider">
                    NIVEL DE ACCESO
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider">
                    RUTAS CON ACCESO
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider">
                    PERMISOS ASIGNADOS
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider">
                    VISTAS PRINCIPALES
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modules.map((mod: any, idx: number) => {
                  const ModIcon = mod.icon;
                  return (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded text-white flex items-center justify-center ${mod.iconBg}`}
                          >
                            <ModIcon className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-slate-900 text-sm">
                            {mod.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${mod.levelColor}`}
                        >
                          {mod.level}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {mod.routes}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {mod.permissions}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {mod.views}
                      </TableCell>
                      <TableCell>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t border-slate-100 flex justify-center">
            <Button
              variant="link"
              className="text-indigo-700 font-semibold h-auto p-0 hover:text-indigo-800 text-sm"
            >
              Ver detalle de permisos por módulo y ruta{" "}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h3 className="font-bold text-slate-900">
              Vistas y rutas con acceso
            </h3>
            <p className="text-sm text-slate-500">
              Listado de rutas principales disponibles para esta posición.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3">
                    RUTA
                  </TableHead>
                  {data.routesList[0]?.module && (
                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3">
                      MÓDULO
                    </TableHead>
                  )}
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3">
                    DESCRIPCIÓN
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3">
                    PERMISOS ASIGNADOS
                  </TableHead>
                  {data.routesList[0]?.access && (
                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3">
                      ACCESO
                    </TableHead>
                  )}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.routesList.map((route: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-700 text-sm">
                      {route.route}
                    </TableCell>
                    {route.module && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-5 h-5 rounded text-white flex items-center justify-center ${route.moduleBg}`}
                          >
                            {route.moduleIcon && (
                              <route.moduleIcon className="w-3 h-3" />
                            )}
                          </div>
                          <span className="text-sm text-slate-700 font-medium">
                            {route.module}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-slate-500 text-sm">
                      {route.desc}
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600">
                        {route.perm}
                      </span>
                    </TableCell>
                    {route.access !== undefined && route.access !== null && (
                      <TableCell>
                        {route.access && (
                          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                            <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                            Con acceso
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-indigo-500 border border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t border-slate-100 flex justify-center">
              <Button
                variant="link"
                className="text-indigo-700 font-semibold h-auto p-0 hover:text-indigo-800 text-sm"
              >
                Ver todas las rutas ({data.routesCount}){" "}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {data.additionalInfo && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col mt-2 p-5">
            <h3 className="font-bold text-slate-900 mb-4">
              Información adicional
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center text-slate-500 font-medium gap-2">
                  <Users className="w-4 h-4" /> Usuarios con esta posición
                </div>
                <div className="text-slate-900 ml-6">
                  {data.additionalInfo.users} usuario
                </div>
                <Button
                  variant="link"
                  className="text-indigo-700 font-medium h-auto p-0 ml-6 justify-start hover:text-indigo-800"
                >
                  Ver usuarios <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center text-slate-500 font-medium gap-2">
                  <Calendar className="w-4 h-4" /> Creada el
                </div>
                <div className="text-slate-900 ml-6">
                  {data.additionalInfo.created}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center text-slate-500 font-medium gap-2">
                  <Calendar className="w-4 h-4" /> Última actualización
                </div>
                <div className="text-slate-900 ml-6">
                  {data.additionalInfo.updated}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center text-slate-500 font-medium gap-2">
                  <AlignLeft className="w-4 h-4" /> Descripción
                </div>
                <div className="text-slate-600 leading-relaxed ml-6">
                  {data.additionalInfo.desc}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
