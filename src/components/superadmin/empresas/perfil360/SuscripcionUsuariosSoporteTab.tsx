import { IEmpresa } from "@/interfaces/superadmin";
import { useSuscripcionEmpresa, useUsuariosEmpresa, useSoporteEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { Ticket as TicketIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function SuscripcionTab({ empresa, userId }: { empresa: IEmpresa; userId: string | null }) {
  const { data: sus, isLoading } = useSuscripcionEmpresa(userId);

  if (!isLoading && !sus) {
    return <EmptyBlock icon={TicketIcon} title="Sin suscripción" description="No se encontró una suscripción para el usuario dueño de esta empresa." />;
  }

  return (
    <Card className="shadow-sm max-w-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Suscripción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sus ? (
          <>
            <KV k="Plan" v={sus.plan?.name ?? "—"} />
            <KV k="Estado" v={sus.status ?? "—"} />
            <KV k="Precio" v={sus.plan?.price ? money(Number(sus.plan.price)) : "—"} />
            <KV k="Vence" v={sus.endDate ? formatDate(sus.endDate) : "—"} />
          </>
        ) : (
          <KV k="Empresa" v={empresa.nombre} />
        )}
      </CardContent>
    </Card>
  );
}

export function UsuariosTab({ empresaId }: { empresaId: string }) {
  const { data, isLoading } = useUsuariosEmpresa(empresaId);

  if (!isLoading && !data.length) {
    return <EmptyBlock icon={Users} title="Sin usuarios" description="Esta empresa todavía no tiene usuarios registrados." />;
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {data.map((u: Record<string, unknown>, i: number) => (
        <div key={String(u.id ?? i)} className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">
            {String(u.name ?? "?").slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">
              {String(u.name ?? "")} {String(u.surname ?? "")}
            </div>
            <div className="truncate text-[10.5px] text-muted-foreground">{String(u.email ?? "")}</div>
          </div>
          <span className="text-[10.5px] font-semibold text-muted-foreground">{String(u.roleName ?? u.role ?? "")}</span>
        </div>
      ))}
    </div>
  );
}

export function SoporteTab({ empresa }: { empresa: IEmpresa }) {
  const { data: tickets, isSimulado } = useSoporteEmpresa(empresa);

  if (!tickets.length) {
    return <EmptyBlock icon={TicketIcon} title="Sin tickets" description="Este negocio no tiene tickets de soporte registrados." />;
  }
  return (
    <div className="space-y-2.5">
      {isSimulado && (
        <div className={cn("rounded-lg border p-2.5 text-[11px] text-muted-foreground", SIMULADO_CARD_CLASS)}>
          <SimuladoBadge /> No hay servicio de tickets real en el backend todavía.
        </div>
      )}
      {tickets.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-lg border px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">{t.asunto}</div>
            <div className="text-[10.5px] text-muted-foreground">
              {t.id} · {formatDate(t.creadoEn)}
            </div>
          </div>
          <StatusBadge label={t.prioridad} tone={t.prioridad === "Alta" ? "red" : t.prioridad === "Media" ? "amber" : "gray"} />
          <StatusBadge label={t.estado} tone={t.estado === "Abierto" ? "red" : t.estado === "En proceso" ? "amber" : "green"} />
        </div>
      ))}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11.5px] last:border-0 last:pb-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold capitalize">{v}</span>
    </div>
  );
}
