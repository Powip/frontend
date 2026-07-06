import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
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
import { AlertTriangle, Edit3 } from "lucide-react";
import React from "react";

interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

interface EditarUsuarioModalProps {
  user: User;
  children: React.ReactNode;
}

export default function EditarUsuarioModal({
  user,
  children,
}: EditarUsuarioModalProps) {
  const getRoleValue = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes("marketing")) return "marketing";
    if (r.includes("ventas")) return "ventas";
    if (r.includes("operaciones")) return "operaciones";
    if (r.includes("admin")) return "administrador";
    if (r.includes("atención") || r.includes("contact")) return "atencion";
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl border-none p-0 overflow-hidden bg-white shadow-xl rounded-2xl">
        <div className="border-b px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <span className="text-xl">✏️</span>
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              Editar – {user.name} {user.surname}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-0.5">
              Modifica datos, rol o permisos
            </DialogDescription>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                NOMBRE <span className="text-red-500">*</span>
              </Label>
              <Input
                defaultValue={user.name}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                APELLIDOS
              </Label>
              <Input
                defaultValue={user.surname}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                EMAIL
              </Label>
              <Input
                defaultValue={user.email}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                TELÉFONO
              </Label>
              <Input
                defaultValue={user.phone}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                ROL
              </Label>
              <Select defaultValue={getRoleValue(user.role)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="ventas">Ventas</SelectItem>
                  <SelectItem value="operaciones">Operaciones</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="atencion">Contact Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                ESTADO
              </Label>
              <Select defaultValue={user.status.toLowerCase()}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl mt-2 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            Cambiar el rol afecta los permisos de acceso del colaborador de
            forma inmediata.
          </div>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-end gap-3 bg-white">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="h-11 px-6 rounded-xl border-slate-200 font-semibold text-slate-700"
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button className="h-11 px-6 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-semibold">
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
