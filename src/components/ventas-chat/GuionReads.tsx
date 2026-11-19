"use client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useScriptReads } from "@/hooks/useCrmContent";
import { ContentError, ContentLoading, formatDateTime } from "./ContentStatus";

/** ¿Leyeron el último guion? Tabla por vendedora. */
export default function GuionReads({ enabled }: { enabled: boolean }) {
  const q = useScriptReads(enabled);
  return (
    <section aria-labelledby="guion-reads" className="space-y-3 rounded-md border bg-card p-4">
      <h2 id="guion-reads" className="text-base font-semibold">
        ¿Leyeron el último guion?
      </h2>
      {q.isLoading && <ContentLoading />}
      {q.isError && <ContentError error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aún no hay vendedoras para mostrar.</p>
      )}
      {q.data && q.data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Versión leída</TableHead>
              <TableHead>Cuándo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>{r.userName}</TableCell>
                <TableCell>{r.readVersion > 0 ? r.readVersion : "—"}</TableCell>
                <TableCell>{formatDateTime(r.readAt) || "—"}</TableCell>
                <TableCell>
                  {r.upToDate ? <Badge variant="secondary">Al día</Badge> : <Badge variant="outline">Pendiente</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
