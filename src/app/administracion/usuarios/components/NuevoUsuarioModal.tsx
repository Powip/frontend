import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  User,
  Crown,
  BadgeDollarSign,
  Truck,
  Megaphone,
  Headphones,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";

const roles = [
  {
    title: "Administrador",
    description: "Acceso total",
    icon: Crown,
    active: true,
  },
  {
    title: "Ventas",
    description: "Pedidos y clientes",
    icon: BadgeDollarSign,
  },
  {
    title: "Operaciones",
    description: "Guías y despacho",
    icon: Truck,
  },
  {
    title: "Marketing",
    description: "Productos y catálogo",
    icon: Megaphone,
  },
  {
    title: "Contact Center",
    description: "Solo atención",
    icon: Headphones,
  },
  {
    title: "Personalizado",
    description: "Define tú mismo",
    icon: Settings2,
  },
];

const modules = [
  {
    name: "Administración",
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
  },
  {
    name: "Ventas",
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
  },
  {
    name: "Estadísticas",
    routes: ["estadisticas/ventas", "estadisticas/analisis"],
  },
  {
    name: "Finanzas",
    routes: ["finanzas/dashboard", "finanzas/liquidaciones", "finanzas/gastos"],
  },
  {
    name: "Operaciones",
    routes: [
      "operaciones/dashboard",
      "operaciones/gestion",
      "operaciones/guias",
      "operaciones/guia/detalle",
      "operaciones/entregados",
      "operaciones/historial",
    ],
  },
  {
    name: "Stock",
    routes: [
      "stock/inventario",
      "stock/producto/detalle",
      "stock/proveedores",
      "stock/almacenes",
      "stock/suministros",
      "stock/salidas",
      "stock/inventario_general",
    ],
  },
  {
    name: "Marketing",
    routes: [
      "marketing/marcas",
      "marketing/modelos",
      "marketing/productos",
      "marketing/categorias",
      "marketing/subcategorias",
    ],
  },
  {
    name: "Contact Center",
    routes: ["contact_center/administrar", "contact_center/mis_pedidos"],
  },
];

export default function NuevoUsuarioModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Nuevo Usuario
        </Button>
      </DialogTrigger>

      <DialogContent className="min-w-7xl max-h-[90vh] overflow-auto p-0">
        <div className="border-b px-8 py-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-100">
              <User className="size-6 text-violet-700" />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Crear nuevo usuario
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground">
                Define datos, rol y permisos específicos
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-8 px-8 py-6">
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Datos personales
                </h3>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="names"
                      className="text-xs font-bold uppercase tracking-wide"
                    >
                      Nombre <span className="text-red-500">*</span>
                    </Label>

                    <Input
                      id="names"
                      placeholder="Nombre"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="last-name"
                      className="text-xs font-bold uppercase tracking-wide"
                    >
                      Apellidos <span className="text-red-500">*</span>
                    </Label>

                    <Input
                      id="last-name"
                      placeholder="Apellidos"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="username"
                      className="text-xs font-bold uppercase tracking-wide"
                    >
                      Usuario / Login <span className="text-red-500">*</span>
                    </Label>

                    <Input
                      id="username"
                      placeholder="ej: cmejia"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide">
                      Género
                    </Label>

                    <Select>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Femenino</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-bold uppercase tracking-wide"
                  >
                    Email <span className="text-red-500">*</span>
                  </Label>

                  <Input
                    id="email"
                    type="email"
                    placeholder="colaborador@empresa.com"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-xs font-bold uppercase tracking-wide"
                  >
                    Teléfono
                  </Label>

                  <div className="flex">
                    <div className="flex h-11 items-center rounded-l-xl border border-r-0 bg-muted px-4 text-sm text-muted-foreground">
                      +51
                    </div>

                    <Input
                      id="phone"
                      type="tel"
                      placeholder="987 654 321"
                      className="h-11 rounded-l-none rounded-r-xl"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Dirección
                  </h4>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="address"
                    className="text-xs font-bold uppercase tracking-wide"
                  >
                    Dirección
                  </Label>

                  <Input
                    id="address"
                    placeholder="Jr. Iquique 807"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="district"
                      className="text-xs font-bold uppercase tracking-wide"
                    >
                      Distrito
                    </Label>

                    <Input
                      id="district"
                      placeholder="Breña"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="dni"
                      className="text-xs font-bold uppercase tracking-wide"
                    >
                      DNI
                    </Label>

                    <Input
                      id="dni"
                      placeholder="12345678"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Contraseña
                  </h4>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-bold uppercase tracking-wide"
                  >
                    Contraseña temporal <span className="text-red-500">*</span>
                  </Label>

                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-700">
                    💡 El colaborador podrá cambiar su contraseña al primer
                    ingreso
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Rol y accesos
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {roles.map((role) => {
                  const Icon = role.icon;

                  return (
                    <button
                      key={role.title}
                      type="button"
                      className={cn(
                        "flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-2xl border bg-background p-4 text-center transition-all hover:border-violet-400 hover:shadow-sm",
                        role.active &&
                          "border-2 border-violet-600 bg-violet-50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl bg-muted",
                          role.active && "bg-violet-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 text-muted-foreground",
                            role.active && "text-violet-700",
                          )}
                        />
                      </div>

                      <div className="space-y-1">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            role.active && "text-violet-700",
                          )}
                        >
                          {role.title}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">
                  Acceso completo a todos los módulos del sistema. Solo para
                  dueños y administradores del negocio.
                </p>
              </div>
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem
              value="permissions"
              className="overflow-hidden rounded-2xl border"
            >
              <AccordionTrigger className="px-6 text-sm font-semibold text-violet-700 hover:no-underline">
                Personalizar permisos por módulo y ruta
              </AccordionTrigger>

              <AccordionContent className="px-6 pb-6">
                <div className="w-full overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Ruta / Módulo</th>

                        <th className="px-4 py-3 text-center font-medium">
                          Ver
                        </th>

                        <th className="px-4 py-3 text-center font-medium">
                          Crear
                        </th>

                        <th className="px-4 py-3 text-center font-medium">
                          Editar
                        </th>

                        <th className="px-4 py-3 text-center font-medium">
                          Eliminar
                        </th>

                        <th className="px-4 py-3 text-center font-medium">
                          Admin
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {modules.map((module) => (
                        <React.Fragment key={module.name}>
                          <tr className="bg-[#0a0f1c] text-white">
                            <td className="px-4 py-2 font-semibold" colSpan={6}>
                              <div className="flex items-center gap-3">
                                <Checkbox className="border-white data-[state=checked]:bg-white data-[state=checked]:text-violet-700" />
                                {module.name}
                              </div>
                            </td>
                          </tr>

                          {module.routes.map((route, index) => (
                            <tr
                              key={route}
                              className={cn(
                                "border-b border-border/50 last:border-0",
                                index % 2 === 0
                                  ? "bg-background"
                                  : "bg-muted/30",
                              )}
                            >
                              <td className="px-4 py-2.5 font-mono text-xs">
                                {route}
                              </td>

                              {[1, 2, 3, 4, 5].map((item) => (
                                <td
                                  key={item}
                                  className="px-4 py-2.5 text-center"
                                >
                                  <div className="flex justify-center">
                                    <Checkbox
                                      defaultChecked={item === 1}
                                      className="rounded-[4px] data-[state=checked]:border-violet-700 data-[state=checked]:bg-violet-700"
                                    />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-background px-8 py-5">
          <Button variant="outline" className="h-11 rounded-xl px-6">
            Cancelar
          </Button>

          <Button className="h-11 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
            Crear usuario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
