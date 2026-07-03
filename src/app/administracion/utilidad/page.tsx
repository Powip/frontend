"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getGastos } from "@/api/Admin";
import { getOrdersByCompany } from "@/api/Ventas";
import { IGastoOperativo } from "@/interfaces/IAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`; }
function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function UtilidadPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    ventas: number; cogs: number; utilBruta: number; margenBruto: number;
    gastos: number; utilOp: number; margenOp: number;
    utilNeta: number; margenNeto: number;
    categorias: { label: string; monto: number; pct: number }[];
  } | null>(null);

  useEffect(() => {
    if (!auth?.company?.id || !auth?.accessToken) return;
    setLoading(true);
    
    
    Promise.all([getOrdersByCompany(auth.company.id, fromDate, toDate), getGastos(auth.company.id, fromDate, toDate, auth.accessToken)])
      .then(([orders, gastos]: [any[], IGastoOperativo[]]) => {
        const entregadas = orders.filter((o) => o.status === "ENTREGADO" && (o.createdAt || o.created_at || ""));
        const ventas = entregadas.reduce((s: number, o: any) => s + Number(o.grandTotal), 0);
        const cogs = entregadas.reduce((s: number, o: any) => s + Number(o.costAmount || 0), 0);
        const utilBruta = ventas - cogs;
        const margenBruto = ventas > 0 ? (utilBruta / ventas) * 100 : 0;
        const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0);
        const utilOp = utilBruta - totalGastos;
        const margenOp = ventas > 0 ? (utilOp / ventas) * 100 : 0;
        const comPowip = ventas * 0.005;
        const igv = utilOp > 0 ? utilOp * 0.015 : 0;
        const utilNeta = utilOp - comPowip - igv;
        const margenNeto = ventas > 0 ? (utilNeta / ventas) * 100 : 0;
        const cats = ["PLANILLA", "HERRAMIENTAS", "PUBLICIDAD", "COURIER_PROPIO", "OTRO"];
        const categorias = cats.map((cat) => {
          const monto = gastos.filter((g) => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0);
          return { label: cat, monto, pct: ventas > 0 ? (monto / ventas) * 100 : 0 };
        });
        setData({ ventas, cogs, utilBruta, margenBruto, gastos: totalGastos, utilOp, margenOp, utilNeta, margenNeto, categorias });
      }).finally(() => setLoading(false));
  }, [auth, fromDate, toDate]);

  if (loading) return <div className="p-8 space-y-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-32"/>)}</div>;
  if (!data) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Margen Bruto", valor: data.utilBruta, margen: data.margenBruto, color: "text-green-600" },
          { label: "Margen Operativo", valor: data.utilOp, margen: data.margenOp, color: "text-amber-600" },
          { label: "Margen Neto", valor: data.utilNeta, margen: data.margenNeto, color: "text-primary" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold font-mono ${item.color}`}>{pct(item.margen)}</p>
              <p className="text-sm text-muted-foreground mt-1">{fmt(item.valor)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Desglose de gastos por categoría (% sobre ventas)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.categorias.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-36">{cat.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(cat.pct, 100)}%` }} />
              </div>
              <span className="text-sm font-mono w-16 text-right">{pct(cat.pct)}</span>
              <span className="text-sm font-mono w-24 text-right text-muted-foreground">{fmt(cat.monto)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
