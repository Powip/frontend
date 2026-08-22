"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Users2, Wallet, HandCoins, Award, Building2 } from "lucide-react";
import {
  getPartnerById,
  getReferidosDelPartner,
  getComisionesDelPartner,
  getLiquidaciones,
  getConfigPrograma,
} from "@/services/superadmin/partnersService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiRow, KpiCardSkeleton, StatusBadge, TableSkeleton } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { EmptyState } from "@/components/ui/empty-state";
import { EstadoComision, EstadoLiquidacion, EstadoReferido } from "@/interfaces/superadmin";

const ESTADO_REFERIDO_TONE: Record<EstadoReferido, "green" | "amber" | "red" | "blue" | "gray"> = {
  pendiente: "amber",
  aprobado: "blue",
  activo: "green",
  rechazado: "red",
  cancelado: "gray",
};

const ESTADO_COMISION_TONE: Record<EstadoComision, "green" | "amber" | "red"> = {
  pendiente: "amber",
  liquidada: "green",
  reversada: "red",
};

const ESTADO_LIQUIDACION_TONE: Record<EstadoLiquidacion, "green" | "amber"> = {
  pendiente: "amber",
  pagada: "green",
};

export default function PortalPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: partner, isLoading } = useQuery({
    queryKey: ["superadmin", "partners", "detail", id],
    queryFn: () => getPartnerById(id),
  });
  const { data: referidos } = useQuery({
    queryKey: ["superadmin", "partners", "referidos", id],
    queryFn: () => getReferidosDelPartner(id),
    enabled: !!partner,
  });
  const { data: comisiones } = useQuery({
    queryKey: ["superadmin", "partners", "comisiones", id],
    queryFn: () => getComisionesDelPartner(id),
    enabled: !!partner,
  });
  const { data: liquidaciones } = useQuery({
    queryKey: ["superadmin", "partners", "liquidaciones"],
    queryFn: getLiquidaciones,
    enabled: !!partner,
  });
  const { data: config } = useQuery({
    queryKey: ["superadmin", "partners", "config"],
    queryFn: getConfigPrograma,
    enabled: !!partner,
  });

  if (isLoading) return <TableSkeleton rows={10} cols={4} />;

  if (!partner) {
    return (
      <EmptyState icon={Building2} title="Partner no encontrado" description="Revisa el enlace o vuelve al listado de Partners." />
    );
  }

  const misLiquidaciones = liquidaciones?.filter((l) => l.partnerId === id) ?? [];
  const comisionesPendientes = comisiones?.filter((c) => c.estado === "pendiente").reduce((a, c) => a + c.monto, 0) ?? 0;
  const opcion = config?.opciones.find((o) => o.id === partner.opcionComision);

  function copiar(valor: string, label: string) {
    navigator.clipboard?.writeText(valor).catch(() => {});
    setCopied(label);
    toast.success(`${label} copiado.`);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <Link
        href="/superadmin/partners"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Partners
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-extrabold text-primary-foreground shrink-0">
          {partner.nombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight">{partner.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge label={partner.estado} tone={partner.estado === "activo" ? "green" : partner.estado === "pendiente" ? "amber" : "red"} />
            <StatusBadge label={`Nivel ${partner.nivel}`} tone="violet" />
            <span>{partner.handle}</span>
            <span>·</span>
            <span>Partner desde {formatDate(partner.creadoEn)}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="mb-4 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
          {[
            ["resumen", "Resumen"],
            ["referidos", "Mis Referidos"],
            ["comisiones", "Comisiones"],
            ["pagos", "Pagos"],
            ["link", "Mi Link & Código"],
            ["plan", "Mi Plan"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen">
          <KpiRow>
            <KpiCard icon={Users2} color="violet" label="Referidos" value={partner.referidosCount} />
            <KpiCard icon={Wallet} color="green" label="MRR activo referido" value={money(partner.mrrActivo)} />
            <KpiCard icon={HandCoins} color="amber" label="Comisiones pendientes" value={money(comisionesPendientes)} />
            <KpiCard icon={Award} color="teal" label="Nivel" value={partner.nivel} sub={`Residual +${partner.acuerdo.residualNivel}%`} />
          </KpiRow>
        </TabsContent>

        <TabsContent value="referidos">
          {!referidos ? (
            <TableSkeleton rows={5} cols={4} />
          ) : !referidos.length ? (
            <EmptyState icon={Users2} title="Sin referidos todavía" description="Comparte tu link para empezar a referir negocios." />
          ) : (
            <ul className="space-y-2">
              {referidos.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.negocio}</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">
                      {r.plan} · {formatDate(r.creadoEn)}
                    </div>
                  </div>
                  <StatusBadge label={r.estado} tone={ESTADO_REFERIDO_TONE[r.estado]} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="comisiones">
          {!comisiones ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !comisiones.length ? (
            <EmptyState icon={HandCoins} title="Sin comisiones todavía" description="Tus comisiones aparecerán aquí a medida que tus referidos se activen." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Referido</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold">Periodo</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-semibold">{c.referidoNombre}</td>
                      <td className="px-3 py-2 capitalize">{c.tipo.replace("_", " ")}</td>
                      <td className="px-3 py-2">{c.periodo}</td>
                      <td className="px-3 py-2 text-right font-bold">{money(c.monto)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={c.estado} tone={ESTADO_COMISION_TONE[c.estado]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pagos">
          {!liquidaciones ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !misLiquidaciones.length ? (
            <EmptyState icon={Wallet} title="Sin pagos todavía" description="Tus liquidaciones aparecerán aquí al cierre de cada ciclo." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ciclo</th>
                    <th className="px-3 py-2 text-right font-semibold">Bruto</th>
                    <th className="px-3 py-2 text-right font-semibold">Reversos</th>
                    <th className="px-3 py-2 text-right font-semibold">Retención</th>
                    <th className="px-3 py-2 text-right font-semibold">Neto</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {misLiquidaciones.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2">{l.ciclo}</td>
                      <td className="px-3 py-2 text-right">{money(l.montoBruto)}</td>
                      <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">-{money(l.montoReversos)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">-{money(l.retencion)}</td>
                      <td className="px-3 py-2 text-right font-bold">{money(l.neto)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={l.estado} tone={ESTADO_LIQUIDACION_TONE[l.estado]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="link">
          <div className="max-w-md space-y-3">
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mi link de referido</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{partner.slugLink}</span>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => copiar(`https://${partner.slugLink}`, "Link")}>
                  <Copy className="h-3 w-3" />
                  {copied === "Link" ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mi código</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{partner.codigo}</span>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => copiar(partner.codigo, "Código")}>
                  <Copy className="h-3 w-3" />
                  {copied === "Código" ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <div className="max-w-md space-y-3 text-xs">
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mi plan de comisión</div>
              <Kv k="Opción" v={partner.opcionComision} />
              <Kv k="1er mes" v={`${partner.overridePct ?? opcion?.firstPct ?? 0}%`} />
              <Kv k="Recurrente" v={`${opcion?.recPct ?? 0}% + ${partner.acuerdo.residualNivel}% residual`} />
              <Kv k="Nivel" v={partner.nivel} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descuento que regalo</div>
              <p className="text-muted-foreground">
                Regalo un <span className="font-bold text-foreground">{partner.descuentoPartnerPct}%</span> de descuento a los negocios que
                refiero. Este descuento sale de mi propia comisión del 1er mes.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}
