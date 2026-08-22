import { useVentasEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsChart from "@/components/superadmin/StatsChart";
import { money } from "@/components/superadmin/shared/format";
import { EmptyBlock, KpiRow, KpiCard } from "@/components/superadmin/shared";
import { LineChart, DollarSign, ShoppingCart, Receipt } from "lucide-react";

export function VentasTab({ empresaId }: { empresaId: string }) {
  const { totalSales, orderCount, ticketPromedio, serieMensual, isLoading } = useVentasEmpresa(empresaId);

  if (!isLoading && orderCount === 0) {
    return (
      <EmptyBlock
        icon={LineChart}
        title="Este negocio aún no registra ventas"
        description="No hay pedidos registrados en ms-ventas para esta empresa."
      />
    );
  }

  return (
    <div className="space-y-3.5">
      <KpiRow>
        <KpiCard icon={DollarSign} color="teal" label="GMV total" value={money(totalSales)} />
        <KpiCard icon={ShoppingCart} color="blue" label="Pedidos" value={orderCount} />
        <KpiCard icon={Receipt} color="green" label="Ticket promedio" value={money(ticketPromedio)} />
      </KpiRow>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">Facturación mensual</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {serieMensual.length > 0 ? (
            <StatsChart
              title=""
              data={serieMensual.map((s) => ({ mes: s.month, actual: s.currentYear, anterior: s.previousYear }))}
              xKey="mes"
              lines={[
                { key: "actual", name: "Este año", color: "#027778" },
                { key: "anterior", name: "Año anterior", color: "#8A90A2" },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin datos de facturación mensual.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
