import { IEmpresa } from "@/interfaces/superadmin";
import { useIntegracionesEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Flame } from "lucide-react";
import { money } from "@/components/superadmin/shared/format";
import { SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function IntegracionesTab({ empresaId, empresa }: { empresaId: string; empresa: IEmpresa }) {
  const { data, upsell, upsellSimulado } = useIntegracionesEmpresa(empresaId, empresa);

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">Integraciones conectadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.map((i) => (
            <div key={i.nombre} className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs">
              {i.conectada ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="font-medium">{i.nombre}</span>
              <span className="ml-auto text-[10.5px] text-muted-foreground">{i.categoria}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={cn("shadow-sm", upsellSimulado && SIMULADO_CARD_CLASS)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">
            Oportunidades de upsell
            {upsellSimulado && <SimuladoBadge />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {!upsell.length && <p className="text-xs text-muted-foreground">Sin oportunidades detectadas por ahora.</p>}
          {upsell.map((o) => (
            <div key={o.titulo} className="rounded-lg border-l-2 border-amber-500 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                {o.caliente && <Flame className="h-3.5 w-3.5 text-emerald-600" />}
                <span className="text-xs font-bold">{o.titulo}</span>
                {o.mrrPotencial > 0 && <span className="ml-auto text-[11px] font-extrabold text-primary">+{money(o.mrrPotencial)}/mes</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{o.motivo}</p>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => toast.success(`Oferta de "${o.titulo}" enviada.`)}>
                Ofrecer
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
