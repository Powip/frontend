import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { IUsuarioEmpresa } from "@/interfaces/superadmin";
import { StatusBadge } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

const PERMISOS_POR_ROL: Record<string, string[]> = {
  Administrador: ["Ver todo", "Crear/editar productos", "Gestionar usuarios", "Ver finanzas", "Exportar datos"],
  Vendedor: ["Registrar ventas", "Ver productos", "Ver sus pedidos"],
  Soporte: ["Ver pedidos", "Responder tickets", "Ver clientes"],
};

export function UsuarioDetailDrawer({ usuario, onClose }: { usuario: IUsuarioEmpresa | null; onClose: () => void }) {
  return (
    <Sheet open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {usuario && (
          <>
            <SheetHeader>
              <SheetTitle>{usuario.nombre}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge label={usuario.rol} tone="violet" />
                <StatusBadge label={usuario.estado} tone={usuario.estado === "activo" ? "green" : usuario.estado === "invitado" ? "blue" : "gray"} />
              </div>
              <div className="space-y-2">
                <Kv k="Email" v={usuario.email} />
                <Kv k="Empresa" v={usuario.empresaNombre} />
                <Kv k="Registro" v={formatDate(usuario.registro)} />
                <Kv k="Último acceso" v={formatDate(usuario.ultimoAcceso)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Permisos por rol</div>
                <ul className="space-y-1.5">
                  {(PERMISOS_POR_ROL[usuario.rol] ?? []).map((p) => (
                    <li key={p} className="text-xs text-muted-foreground">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
