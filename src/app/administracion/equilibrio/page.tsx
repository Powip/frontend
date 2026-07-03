"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAdminOrders, useAdminGastos } from "@/hooks/useAdminQueries";
import { IGastoOperativo } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`; }

export default function EquilibrioPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();

  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";

  const { data: orders = [], isLoading: loadingOrders } = useAdminOrders(companyId, fromDate, toDate);
  const { data: gastos = [], isLoading: loadingGastos } = useAdminGastos(companyId, fromDate, toDate, token);

  const loading = loadingOrders || loadingGastos;

  const [costosFijos, setCostosFijos] = useState(0);
  const [precioPromedio, setPrecioPromedio] = useState(0);
  const [costoVariableUnit, setCostoVariableUnit] = useState(0);

  useEffect(() => {
    const entregadas = (orders as any[]).filter((o) => o.status === "ENTREGADO");
    const totalVentas = entregadas.reduce((s: number, o: any) => s + Number(o.grandTotal), 0);
    const totalUnidades = entregadas.reduce((s: number, o: any) => s + (o.itemCount || 1), 0);
    const totalCogs = entregadas.reduce((s: number, o: any) => s + Number(o.costAmount || 0), 0);
    setCostosFijos((gastos as IGastoOperativo[]).reduce((s, g) => s + Number(g.monto), 0));
    setPrecioPromedio(totalUnidades > 0 ? totalVentas / totalUnidades : 0);
    setCostoVariableUnit(totalUnidades > 0 ? totalCogs / totalUnidades : 0);
  }, [orders, gastos]);

  const margenContribucion = precioPromedio - costoVariableUnit;
  const puntoEquilibrioUnidades = margenContribucion > 0 ? Math.ceil(costosFijos / margenContribucion) : 0;
  const puntoEquilibrioSoles = puntoEquilibrioUnidades * precioPromedio;

  if (loading) return <div className="p-8 space-y-4">{Array.from({length:2}).map((_,i)=><Skeleton key={i} className="h-40"/>)}</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Costos Fijos del mes", value: costosFijos, setter: setCostosFijos, hint: "Ajustar si es necesario" },
          { label: "Precio promedio por unidad", value: precioPromedio, setter: setPrecioPromedio, hint: "Calculado desde ventas entregadas" },
          { label: "Costo variable por unidad", value: costoVariableUnit, setter: setCostoVariableUnit, hint: "Calculado desde COGS" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <Label className="text-xs">{item.hint}</Label>
              <Input type="number" className="font-mono mt-1" value={item.value.toFixed(2)} onChange={(e) => item.setter(Number(e.target.value))} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Margen de contribución", valor: fmt(margenContribucion), sub: "por unidad" },
          { label: "Punto de equilibrio", valor: `${puntoEquilibrioUnidades} uds.`, sub: "para cubrir costos fijos" },
          { label: "Ventas mínimas necesarias", valor: fmt(puntoEquilibrioSoles), sub: "para no perder dinero" },
        ].map((item) => (
          <Card key={item.label} className="bg-primary/5 border-primary/20">
            <CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold font-mono text-primary">{item.valor}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
