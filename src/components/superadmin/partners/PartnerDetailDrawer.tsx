"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Link2, CheckCircle2, Ban } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  usePartnerDetail,
  useReferidosDePartner,
  useConfigPrograma,
  useAprobarPartner,
  useSuspenderPartner,
  calcularDetalleComision,
} from "@/hooks/superadmin/usePartners";
import { StatusBadge, SimuladoBadge } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { EstadoPartner, EstadoReferido } from "@/interfaces/superadmin";

const ESTADO_PARTNER_TONE: Record<EstadoPartner, "green" | "amber" | "red"> = {
  activo: "green",
  pendiente: "amber",
  suspendido: "red",
};

const ESTADO_REFERIDO_TONE: Record<EstadoReferido, "green" | "amber" | "red" | "blue" | "gray"> = {
  pendiente: "amber",
  aprobado: "blue",
  activo: "green",
  rechazado: "red",
  cancelado: "gray",
};

interface Props {
  partnerId: string | null;
  onClose: () => void;
}

export function PartnerDetailDrawer({ partnerId, onClose }: Props) {
  const router = useRouter();

  const { data: partner, isSimulado: partnerSimulado } = usePartnerDetail(partnerId);
  const { data: referidos, isSimulado: referidosSimulado } = useReferidosDePartner(partnerId);
  const { data: config } = useConfigPrograma();

  const { mutate: aprobar } = useAprobarPartner();
  const { mutate: suspender } = useSuspenderPartner();

  function handleAprobar(id: string) {
    aprobar(id, { onSuccess: (p) => p && toast.success(`${p.nombre} fue aprobado y ahora está activo.`) });
  }

  function handleSuspender(id: string) {
    suspender(id, { onSuccess: (p) => p && toast.success(`${p.nombre} ahora está "${p.estado}".`) });
  }

  function copiarLink() {
    if (!partner) return;
    navigator.clipboard?.writeText(`https://${partner.slugLink}`).catch(() => {});
    toast.success("Link de referido copiado al portapapeles.");
  }

  return (
    <Sheet open={!!partnerId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {partner && (
          <>
            <SheetHeader>
              <SheetTitle>
                {partner.nombre}
                {partnerSimulado && <SimuladoBadge />}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge label={partner.estado} tone={ESTADO_PARTNER_TONE[partner.estado]} />
              <StatusBadge label={`Nivel ${partner.nivel}`} tone="violet" />
              <span className="text-xs text-muted-foreground">{partner.handle}</span>
            </div>

            {/* Datos */}
            <div className="mt-4 space-y-2 text-xs">
              <Kv k="Tipo" v={partner.tipo} />
              <Kv k="Código" v={partner.codigo} />
              <Kv k="Link" v={partner.slugLink} />
              <Kv k="Método de cobro" v={partner.metodoCobro} />
              <Kv k="Partner desde" v={formatDate(partner.creadoEn)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copiarLink}>
                <Link2 className="h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => router.push(`/superadmin/partners/${partner.id}/portal`)}
              >
                <Globe className="h-3.5 w-3.5" />
                Ver portal del partner
              </Button>
              {partner.estado === "pendiente" && (
                <Button size="sm" className="gap-1.5" onClick={() => handleAprobar(partner.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprobar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30"
                onClick={() => handleSuspender(partner.id)}
              >
                <Ban className="h-3.5 w-3.5" />
                {partner.estado === "suspendido" ? "Reactivar" : "Suspender"}
              </Button>
            </div>

            {/* Acuerdo */}
            <div className="mt-5 rounded-lg border p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Acuerdo</div>
              <div className="space-y-2 text-xs">
                <Kv k="Opción de comisión" v={partner.opcionComision} />
                {partner.overridePct !== undefined && <Kv k="Override 1er mes" v={`${partner.overridePct}%`} />}
                <Kv k="Vigencia hasta" v={formatDate(partner.acuerdo.vigenciaHasta)} />
                <Kv k="Exclusividad de rubro" v={partner.acuerdo.exclusividadRubro ?? "Sin exclusividad"} />
                <Kv k="Residual por nivel" v={`${partner.acuerdo.residualNivel}%`} />
              </div>
            </div>

            {/* Descuento del partner */}
            <div className="mt-3 rounded-lg border p-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Descuento del partner</div>
              <p className="text-xs text-muted-foreground">
                {partner.nombre} regala un <span className="font-bold text-foreground">{partner.descuentoPartnerPct}%</span> de descuento a
                sus referidos, absorbido desde su propia comisión — el ingreso de POWIP no se ve afectado.
              </p>
            </div>

            {/* Detalle de comisión por referido */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Detalle de comisión por referido
                {referidosSimulado && <SimuladoBadge />}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-semibold">Negocio</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Precio neto</th>
                      <th className="px-2.5 py-2 text-right font-semibold">1er mes</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Recurrente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referidos.map((r) => {
                      const detalle = calcularDetalleComision(partner, r, config);
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="px-2.5 py-2 font-semibold truncate max-w-[140px]">{r.negocio}</td>
                          <td className="px-2.5 py-2 text-right">{money(detalle.precioNeto)}</td>
                          <td className="px-2.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {money(detalle.comisionPrimerMes)}
                            <span className="ml-1 text-muted-foreground font-normal">({detalle.firstPct}%)</span>
                          </td>
                          <td className="px-2.5 py-2 text-right font-bold">
                            {money(detalle.comisionRecurrente)}
                            <span className="ml-1 text-muted-foreground font-normal">
                              ({detalle.recPct}%+{detalle.residualNivel}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!referidos.length && (
                      <tr>
                        <td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">
                          Sin referidos todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Referidos */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Referidos ({referidos?.length ?? 0})
              </div>
              <ul className="space-y-2">
                {referidos?.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.negocio}</div>
                      <div className="text-[10.5px] text-muted-foreground truncate">
                        {r.plan} · {formatDate(r.creadoEn)}
                      </div>
                    </div>
                    <StatusBadge label={r.estado} tone={ESTADO_REFERIDO_TONE[r.estado]} />
                  </li>
                ))}
                {!referidos?.length && <li className="text-xs text-muted-foreground">Sin referidos todavía.</li>}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}
