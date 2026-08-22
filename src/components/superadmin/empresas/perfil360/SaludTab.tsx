import { IEmpresa, IHealthFactor } from "@/interfaces/superadmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "@/components/superadmin/shared/charts/Gauge";
import { cn } from "@/lib/utils";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";

export function SaludTab({ empresa, health }: { empresa: IEmpresa; health: IHealthFactor[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <Card className={cn("shadow-sm", SIMULADO_CARD_CLASS)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">
            Health Score
            <SimuladoBadge />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Gauge value={70} max={100} label="puntaje de salud — sin cálculo real todavía" tone="amber" />
          <ul className="mt-3 space-y-1.5 border-t pt-3">
            {health.map((f) => (
              <li key={f.label} className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted-foreground">{f.label}</span>
                <span className={cn("font-semibold", f.positivo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {f.valor}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">Datos del negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <KV k="RUC" v={empresa.ruc ?? "—"} />
          <KV k="Canales de venta" v={empresa.canalesVenta.length ? empresa.canalesVenta.join(", ") : "—"} />
          <KV k="Cliente desde" v={new Date(empresa.creadoEn).toLocaleDateString("es-PE")} />
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11.5px] last:border-0 last:pb-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
