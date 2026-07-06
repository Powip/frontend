import Link from "next/link";
import {
  ChevronRight,
  Edit2,
  Lock,
  LayoutGrid,
  Folder,
  Shield,
  ShieldAlert,
  Check,
  ChevronDown,
  ArrowRight,
  Activity,
  BarChart2,
  DollarSign,
  Truck,
  Package,
  Megaphone,
  Headphones,
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
import {
  mockUsers,
  ALL_MODULES,
  PERMISSIONS_BY_ROLE,
  TOTAL_ALL_MODULES,
  TOTAL_ALL_ROUTES,
  TOTAL_ALL_PERMISSIONS,
} from "../data";

const MODULE_ICONS: Record<string, React.ReactNode> = {
  Administración: <Shield className="w-4 h-4 text-white" />,
  Ventas: <LayoutGrid className="w-4 h-4 text-white" />,
  Estadísticas: <BarChart2 className="w-4 h-4 text-white" />,
  Finanzas: <DollarSign className="w-4 h-4 text-white" />,
  Operaciones: <Truck className="w-4 h-4 text-white" />,
  Stock: <Package className="w-4 h-4 text-white" />,
  Marketing: <Megaphone className="w-4 h-4 text-white" />,
  "Contact Center": <Headphones className="w-4 h-4 text-white" />,
};

const ACCESS_LEVEL_DESCRIPTIONS: Record<string, string> = {
  Alto: "Acceso completo a la mayoría de módulos críticos",
  Medio: "Acceso operativo a módulos clave del sistema",
  Bajo: "Acceso limitado a módulos específicos",
};

const mockRecentActivity = [
  {
    date: "23 may, 2024 10:32",
    action: "Inicio de sesión",
    badgeColor: "text-emerald-700 bg-emerald-50",
    detail: "Inicio de sesión exitoso",
    ip: "190.112.45.12",
  },
  {
    date: "23 may, 2024 10:15",
    action: "Actualización de perfil",
    badgeColor: "text-blue-700 bg-blue-50",
    detail: "Se actualizaron los datos personales del usuario",
    ip: "190.112.45.12",
  },
  {
    date: "22 may, 2024 16:47",
    action: "Cambio de contraseña",
    badgeColor: "text-amber-700 bg-amber-50",
    detail: "El usuario cambió su contraseña",
    ip: "190.112.45.12",
  },
];

function computeUserStats(roleString: string) {
  const roles = roleString.split("/").map((r) => r.trim());
  const hasAdmin = roles.includes("Administrador");

  const accessedModuleNames = new Set<string>();

  roles.forEach((roleName) => {
    PERMISSIONS_BY_ROLE[roleName]?.moduleNames.forEach((m) =>
      accessedModuleNames.add(m),
    );
  });

  const accessedModules = ALL_MODULES.filter((m) =>
    accessedModuleNames.has(m.name),
  );

  const totalModules = accessedModules.length;

  const totalRoutes = accessedModules.reduce(
    (sum, m) => sum + m.routes.length,
    0,
  );

  const totalPermissions = accessedModules.reduce(
    (sum, m) => sum + m.permissionsCount,
    0,
  );

  const accessLevel: "Alto" | "Medio" | "Bajo" = hasAdmin
    ? "Alto"
    : totalPermissions >= 100
      ? "Alto"
      : totalPermissions >= 30
        ? "Medio"
        : "Bajo";

  return {
    hasAdmin,
    accessedModules,
    totalModules,
    totalRoutes,
    totalPermissions,
    accessLevel,
  };
}

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserResumenPage({ params }: PageProps) {
  const { id } = await params;

  const user = mockUsers.find((u) => u.id === Number(id));

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 text-sm">
        Usuario no encontrado
      </div>
    );
  }

  const {
    hasAdmin,
    accessedModules,
    totalModules,
    totalRoutes,
    totalPermissions,
    accessLevel,
  } = computeUserStats(user.role);

  const featuredModule = accessedModules[0] ?? null;

  const featuredRoutes = featuredModule?.routes.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="px-6 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center text-sm text-slate-500 mb-6">
          <Link
            href="/administracion/usuarios"
            className="hover:text-indigo-600 transition-colors"
          >
            Usuarios
          </Link>

          <ChevronRight className="w-4 h-4 mx-1" />

          <span>Perfil de usuario</span>

          <ChevronRight className="w-4 h-4 mx-1" />

          <span className="text-slate-900 font-medium">Resumen</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-full ${user.color} text-white flex items-center justify-center text-2xl font-bold shadow-sm`}
            >
              {user.initials}
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {user.name} {user.surname}
              </h1>

              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span>{user.user}</span>

                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      user.status === "Activo"
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                  />

                  <span
                    className={`font-medium ${
                      user.status === "Activo"
                        ? "text-emerald-600"
                        : "text-slate-400"
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-indigo-600 border-slate-200 hover:bg-slate-50"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar usuario
            </Button>

            <Button className="bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm">
              <Lock className="w-4 h-4 mr-2" />
              Cambiar permisos
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-8">
          <div className="relative pb-3 text-indigo-700 font-semibold border-b-2 border-indigo-700 cursor-pointer">
            Resumen
          </div>

          <div className="relative pb-3 text-slate-500 font-medium hover:text-slate-700 cursor-pointer">
            Editar
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-indigo-600 text-white flex-shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>

            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Módulos con acceso
              </div>

              <div className="text-2xl font-bold text-slate-900">
                {totalModules}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                de {TOTAL_ALL_MODULES} disponibles
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
                {totalRoutes}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                de {TOTAL_ALL_ROUTES} disponibles
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-600 text-white flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>

            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Permisos totales
              </div>

              <div className="text-2xl font-bold text-slate-900">
                {totalPermissions}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                de {TOTAL_ALL_PERMISSIONS} posibles
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-amber-500 text-white flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>

            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">
                Nivel de acceso
              </div>

              <div className="text-2xl font-bold text-slate-900">
                {accessLevel}
              </div>

              <div className="text-xs text-slate-500 mt-1 leading-tight">
                {ACCESS_LEVEL_DESCRIPTIONS[accessLevel]}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Acceso por módulo</h3>
            </div>

            <div className="p-2 flex-1">
              <div className="flex flex-col gap-1">
                {accessedModules.length > 0 ? (
                  accessedModules.map((mod) => (
                    <div
                      key={mod.name}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${mod.iconColor}`}
                        >
                          {MODULE_ICONS[mod.name] ?? (
                            <Shield className="w-4 h-4 text-white" />
                          )}
                        </div>

                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {mod.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                          Total
                        </span>

                        <span className="text-sm text-slate-500 text-right">
                          {mod.routes.length} rutas
                        </span>

                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-slate-400">
                    Sin módulos asignados
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Permisos destacados</h3>
            </div>

            <div className="flex-1 overflow-x-auto">
              <Table>
                <TableHeader className="bg-transparent">
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider py-3 min-w-[220px]">
                      RUTA / PERMISO
                    </TableHead>

                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider text-center py-3">
                      VER
                    </TableHead>

                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider text-center py-3">
                      CREAR
                    </TableHead>

                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider text-center py-3">
                      EDITAR
                    </TableHead>

                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider text-center py-3">
                      ELIMINAR
                    </TableHead>

                    <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider text-center py-3">
                      ADMIN
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {featuredModule ? (
                    <>
                      <TableRow className="bg-[#0a0f2c] hover:bg-[#0a0f2c] border-b-0">
                        <TableCell colSpan={6} className="py-2.5 px-4">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm">
                              {featuredModule.name}
                            </span>

                            <ChevronDown className="w-4 h-4 text-white/50" />
                          </div>
                        </TableCell>
                      </TableRow>

                      {featuredRoutes.map((route) => (
                        <TableRow
                          key={route}
                          className="border-b border-slate-100 hover:bg-slate-50/50"
                        >
                          <TableCell className="text-sm font-medium text-slate-600 py-3">
                            {route}
                          </TableCell>

                          <CheckCell active />

                          <CheckCell active={hasAdmin} />

                          <CheckCell active={hasAdmin} />

                          <CheckCell active={hasAdmin} />

                          <CheckCell active={hasAdmin} />
                        </TableRow>
                      ))}
                    </>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-slate-400 text-sm py-6"
                      >
                        Sin permisos asignados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button
                variant="link"
                className="text-indigo-700 font-semibold h-auto p-0 hover:text-indigo-800"
              >
                Ver todos los permisos
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-500" />

            <h3 className="font-bold text-slate-900">Actividad reciente</h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider min-w-[180px]">
                    FECHA
                  </TableHead>

                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider min-w-[220px]">
                    ACCIÓN
                  </TableHead>

                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider min-w-[280px]">
                    DETALLE
                  </TableHead>

                  <TableHead className="font-semibold text-slate-500 text-[10px] tracking-wider min-w-[150px]">
                    IP
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {mockRecentActivity.map((activity, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm text-slate-600 font-medium">
                      {activity.date}
                    </TableCell>

                    <TableCell>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${activity.badgeColor}`}
                      >
                        {activity.action}
                      </span>
                    </TableCell>

                    <TableCell className="text-sm text-slate-500">
                      {activity.detail}
                    </TableCell>

                    <TableCell className="text-sm text-slate-500">
                      {activity.ip}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-end">
            <Button
              variant="link"
              className="text-indigo-700 font-semibold h-auto p-0 hover:text-indigo-800"
            >
              Ver historial completo
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCell({ active }: { active: boolean }) {
  return (
    <TableCell className="text-center py-3">
      {active ? (
        <div className="mx-auto w-4 h-4 rounded-sm bg-emerald-500 text-white flex items-center justify-center">
          <Check className="w-3 h-3" />
        </div>
      ) : (
        <span className="text-slate-300">-</span>
      )}
    </TableCell>
  );
}
