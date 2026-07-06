import * as React from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Key, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

const colors = [
  "bg-violet-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-pink-600",
  "bg-blue-600",
  "bg-emerald-600",
];

interface CrearRolModalProps {
  trigger?: React.ReactNode;
}

export default function CrearRolModal({ trigger }: CrearRolModalProps) {
  const [selectedColor, setSelectedColor] = React.useState(colors[0]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Crear rol personalizado
        </Button>
      </DialogTrigger>

      <DialogContent className="min-w-7xl max-h-[90vh] overflow-auto">
        <div className="border-b px-8 py-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50">
              <Key className="size-6 text-amber-500" />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Crear rol personalizado
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground">
                Define un perfil de acceso exacto para un tipo de colaborador
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-8 px-8 py-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Nombre del rol <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ej: Asistente de ventas, Supervisor de despacho..."
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Descripción corta
              </Label>
              <Input
                placeholder="¿Para qué tipo de colaborador es este rol?"
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Color identificador
            </Label>
            <div className="flex gap-3">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "size-8 rounded-full transition-all",
                    color,
                    selectedColor === color &&
                      "ring-2 ring-offset-2 ring-indigo-600",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Matriz de permisos
              </Label>
              <p className="text-sm text-muted-foreground">
                Selecciona exactamente a qué puede acceder este rol. Puedes
                marcar por sección completa o ruta individual.
              </p>
            </div>

            <div className="w-full overflow-x-auto rounded-lg border">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ruta / Módulo</th>
                    <th className="px-4 py-3 font-medium text-center">Ver</th>
                    <th className="px-4 py-3 font-medium text-center">Crear</th>
                    <th className="px-4 py-3 font-medium text-center">
                      Editar
                    </th>
                    <th className="px-4 py-3 font-medium text-center">
                      Eliminar
                    </th>
                    <th className="px-4 py-3 font-medium text-center">Admin</th>
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
                            index % 2 === 0 ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {route}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                defaultChecked
                                className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 rounded-[4px]"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <Checkbox className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 rounded-[4px]" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <Checkbox className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 rounded-[4px]" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <Checkbox className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 rounded-[4px]" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex justify-center">
                              <Checkbox className="data-[state=checked]:bg-violet-700 data-[state=checked]:border-violet-700 rounded-[4px]" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-background px-8 py-5">
          <Button variant="outline" className="h-11 rounded-xl px-6">
            Cancelar
          </Button>
          <Button className="h-11 rounded-xl bg-indigo-600 px-6 hover:bg-indigo-700">
            Guardar rol personalizado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
