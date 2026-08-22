"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Target } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRadarUpsell } from "@/hooks/superadmin/useOportunidades";
import { ExportButton, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function RadarUpsellTable() {
  const router = useRouter();
  const { data, isLoading, isSimulado } = useRadarUpsell();

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.length) {
    return <EmptyBlock icon={Target} title="Sin oportunidades de upsell" description="No hay oportunidades detectadas con los datos actuales." />;
  }

  return (
    <div className={cn(isSimulado && cn("rounded-xl p-3.5", SIMULADO_CARD_CLASS))}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {isSimulado && <SimuladoBadge />}
        <ExportButton
          filename="radar_upsell"
          rows={data.map((r) => ({ Empresa: r.empresaNombre, Plan: r.plan, Motivo: r.motivo, MRR_Potencial: r.mrrPotencial, Caliente: r.caliente ? "Sí" : "No" }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>MRR potencial</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={`${r.empresaId}-${r.motivo}`} className="cursor-pointer" onClick={() => router.push(`/superadmin/empresas/${r.empresaId}`)}>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {r.empresaNombre}
                    {r.caliente && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                        <Flame className="h-3 w-3" />
                        Caliente
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{r.plan}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.motivo}</TableCell>
                <TableCell className="text-xs font-bold">{money(r.mrrPotencial)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`Oferta enviada a ${r.empresaNombre} (mock).`);
                    }}
                  >
                    Ofrecer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
