"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";

interface SeriesTabProps {
  mock: ReturnType<typeof useFacturacionMock>;
}

export function SeriesTab({ mock }: SeriesTabProps) {
  const { series, toggleSerie } = mock;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Series y Correlativos</h2>
        <p className="text-sm text-muted-foreground">
          Cada serie lleva su propio contador. Powip reserva el siguiente número de forma atómica al emitir, para nunca duplicar.
        </p>
      </div>

      <BetaBanner>
        Los correlativos que ves aquí se generan durante esta sesión de vista previa (comprobantes, guías y notas emitidas
        mientras navegás). Al recargar la página vuelven a cero.
      </BetaBanner>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Series configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serie</TableHead>
                  <TableHead>Tipo de documento</TableHead>
                  <TableHead>Último correlativo</TableHead>
                  <TableHead>Siguiente</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((s) => (
                  <TableRow key={s.serie}>
                    <TableCell className="font-bold">{s.serie}</TableCell>
                    <TableCell className="text-xs">{s.tipo}</TableCell>
                    <TableCell>{s.ultimo}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.serie}-{String(s.ultimo + 1).padStart(8, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={s.activa} onCheckedChange={() => toggleSerie(s.serie)} />
                        <span className={s.activa ? "text-green-600 text-xs font-semibold" : "text-muted-foreground text-xs font-semibold"}>
                          {s.activa ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
