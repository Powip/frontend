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
import { Mail, CheckSquare } from "lucide-react";

export default function InvitarEmailModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-white">
          <Mail className="w-4 h-4 mr-2 text-slate-500" />
          Invitar por email
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw] max-w-2xl overflow-hidden rounded-3xl p-0">
        <div className="border-b px-8 py-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100">
              <Mail className="size-6 text-blue-700" />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Invitar por email
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground">
                El colaborador recibe un email con sus credenciales de acceso
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
            <CheckSquare className="size-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 leading-relaxed">
              <span className="font-bold">Ventaja:</span> El perfil queda creado automáticamente con el correo como usuario. El colaborador solo necesita establecer su contraseña al primer ingreso.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email-colaborador"
                className="text-xs font-bold uppercase tracking-wide"
              >
                Email del colaborador <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email-colaborador"
                type="email"
                placeholder="colaborador@empresa.com"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="nombre-completo"
                className="text-xs font-bold uppercase tracking-wide"
              >
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre-completo"
                placeholder="Para personalizar el email de bienvenida"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide">
                Rol a asignar <span className="text-red-500">*</span>
              </Label>
              <Select>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecciona el rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="ventas">Ventas</SelectItem>
                  <SelectItem value="operaciones">Operaciones</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="contact-center">Contact Center</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/60 p-4 flex gap-3 items-start">
            <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Se enviará un email a la dirección ingresada con el link para activar su cuenta y establecer su contraseña. El link expira en 48 horas.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-background px-8 py-5">
          <Button variant="outline" className="h-11 rounded-xl px-6">
            Cancelar
          </Button>

          <Button className="h-11 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
            Enviar invitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
