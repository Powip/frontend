import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CrearRolModal from "./CrearRolModal";

const roles = [
  {
    id: "admin",
    icon: "👑",
    title: "Administrador",
    description: "Acceso completo al sistema. Para dueños y admins.",
    badges: ["Todo"],
    usersCount: 2,
    borderClass: "border-indigo-600 shadow-md",
    hasPermissionsInterface: false,
  },
  {
    id: "ventas",
    icon: "💬",
    title: "Ventas",
    description: "Pedidos, clientes, devoluciones, preparaciones.",
    badges: ["Pedidos", "Clientes", "Ventas"],
    usersCount: 3,
    borderClass: "border-slate-200",
    hasPermissionsInterface: true,
  },
  {
    id: "operaciones",
    icon: "🚚",
    title: "Operaciones",
    description: "Guías, despacho, couriers, historial de envíos.",
    badges: ["Operaciones", "Couriers", "Guías"],
    usersCount: 2,
    borderClass: "border-slate-200",
    hasPermissionsInterface: true,
  },
  {
    id: "marketing",
    icon: "📣",
    title: "Marketing",
    description: "Productos, categorías, modelos, marcas.",
    badges: ["Productos", "Catálogo", "Stock"],
    usersCount: 2,
    borderClass: "border-slate-200",
    hasPermissionsInterface: false,
  },
  {
    id: "contact-center",
    icon: "🎧",
    title: "Contact Center",
    description: "Solo acceso al módulo de atención al cliente.",
    badges: ["Contact Center"],
    usersCount: 1,
    borderClass: "border-slate-200",
    hasPermissionsInterface: true,
  },
  {
    id: "personalizado",
    icon: "⚙️",
    title: "Personalizado",
    description: "Crea un perfil de acceso a medida.",
    badges: ["Configurable"],
    usersCount: 2,
    borderClass: "border-indigo-600 border-dashed",
    isCustom: true,
  },
];

export default function RolesPermisosTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <CrearRolModal />

        <p className="text-sm text-slate-500">
          Los roles personalizados te permiten definir exactamente a qué módulos
          y acciones tiene acceso cada colaborador.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`flex flex-col justify-between rounded-xl border bg-white p-5 ${
              role.borderClass
            } ${role.id === "admin" ? "ring-1 ring-indigo-600" : ""}`}
          >
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-xl">
                  {role.icon}
                </div>

                <div className="rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {role.usersCount} usuarios
                </div>
              </div>

              <h3 className="mb-1 font-bold text-slate-900">{role.title}</h3>

              <p className="mb-4 h-10 text-sm text-slate-500">
                {role.description}
              </p>

              <div className="mb-6 flex h-6 flex-wrap gap-2">
                {role.badges.map((badge, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="bg-slate-100 font-normal text-slate-600 hover:bg-slate-200"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-200 bg-white"
              >
                Ver usuarios
              </Button>

              {role.isCustom ? (
                <CrearRolModal
                  trigger={
                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                      Crear nuevo
                    </Button>
                  }
                />
              ) : role.hasPermissionsInterface ? (
                <Link
                  href={`/administracion/roles/${role.id}`}
                  className="flex-1 flex"
                >
                  <Button className="w-full flex-1 bg-indigo-600 hover:bg-indigo-700">
                    Editar permisos
                  </Button>
                </Link>
              ) : (
                <Button
                  disabled
                  className="w-full flex-1 cursor-not-allowed bg-slate-100 text-slate-400 hover:bg-slate-100"
                >
                  Próximamente
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
