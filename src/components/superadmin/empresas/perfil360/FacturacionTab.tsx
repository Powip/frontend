import { IEmpresa } from "@/interfaces/superadmin";
import { useFacturacionEmpresa } from "@/hooks/superadmin/useEmpresas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function FacturacionTab({ empresaId, empresa }: { empresaId: string; empresa: IEmpresa }) {
  const { data: comprobantes, isSimulado } = useFacturacionEmpresa(empresaId, empresa);

  return (
    <div>
      {isSimulado && (
        <div className={cn("mb-3 rounded-lg border p-3 text-[11px] text-muted-foreground", SIMULADO_CARD_CLASS)}>
          <SimuladoBadge /> El endpoint real de SUNAT hoy saca el scope del JWT del usuario logueado, no acepta un `companyId` — sin
          impersonación real no se puede traer comprobantes de una empresa arbitraria. Ver docs/superadmin/empresas-endpoints.md.
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>IGV</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comprobantes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs">{c.tipo}</TableCell>
                <TableCell className="text-xs font-mono">{c.numero}</TableCell>
                <TableCell className="text-xs font-bold">{money(c.monto)}</TableCell>
                <TableCell className="text-xs">{money(c.igv)}</TableCell>
                <TableCell>
                  <StatusBadge label={c.estado} tone={c.estado === "Emitido" ? "green" : c.estado === "Rechazado" ? "red" : "gray"} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(c.fecha)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
