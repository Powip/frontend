import { IEmpresa } from "@/interfaces/superadmin";
import { usePagosEmpresa, useCouriersEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/components/superadmin/shared/format";
import { SimuladoBadge, SIMULADO_CARD_CLASS, EmptyBlock } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";
import { Truck } from "lucide-react";

export function PagosTab({ empresa }: { empresa: IEmpresa }) {
  const { data } = usePagosEmpresa(empresa);
  if (!data) return null;

  return (
    <div className={cn("rounded-xl border p-5", SIMULADO_CARD_CLASS)}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-bold">Pagos & Recaudos</h3>
        <SimuladoBadge />
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Ya documentado en <code>src/components/finanzas/BACKEND_REQUERIMIENTOS.md</code> — faltan endpoints de ms-courier
        (liquidaciones, adelantos COD) que hoy no existen. No lo duplicamos acá.
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label="Cómo cobra" value={data.metodoCobro} />
        <Stat label="COD en tránsito" value={money(data.codEnTransito)} />
        <Stat label="Morosidad" value={`${data.morosidadPct}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-3">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function EnviosTab({ empresaId }: { empresaId: string }) {
  const { data, isLoading } = useCouriersEmpresa(empresaId);

  if (!isLoading && !data.length) {
    return <EmptyBlock icon={Truck} title="Sin couriers conectados" description="Este negocio aún no configuró couriers de envío." />;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Couriers conectados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {data.map((c) => (
            <span key={c.id} className="rounded-full border bg-muted/40 px-3 py-1 text-[11px] font-semibold">
              {c.name}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] text-muted-foreground">% de entrega/devolución agregado no está disponible todavía — se derivaría de las guías individuales.</p>
      </CardContent>
    </Card>
  );
}
