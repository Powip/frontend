import {
  Card,
  CardContent,
  CardDescription,
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
import { ERRORES_GRE, ERRORES_SUNAT } from "@/types/facturacion";

const DISTRIBUCION = [
  { k: "WhatsApp", v: "Abre wa.me con mensaje preformateado (correlativo, monto)" },
  { k: "Imprimir", v: "Vista HTML con formato SUNAT, lista para imprimir o guardar como PDF" },
  { k: "PDF", v: "Descarga directa generada por el OSE" },
  { k: "Email", v: "Próximamente: envío automático con el PDF adjunto" },
  { k: "Link público", v: "Próximamente: powip.lat/comprobante/token — el cliente lo consulta cuando quiera" },
];

function codeColor(code: string) {
  if (code === "0") return "text-green-600";
  if (code === "2000") return "text-amber-600";
  return "text-red-600";
}

export function AyudaTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Ayuda · Códigos de error SUNAT</h2>
        <p className="text-sm text-muted-foreground">Referencia rápida cuando un comprobante es rechazado por el OSE / SUNAT.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Solución para el operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ERRORES_SUNAT.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className={`font-bold ${codeColor(e.code)}`}>{e.code}</TableCell>
                    <TableCell className="text-sm">{e.desc}</TableCell>
                    <TableCell className="text-sm">{e.sol}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Errores frecuentes en Guías de Remisión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Solución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ERRORES_GRE.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className={`font-bold ${codeColor(e.code)}`}>{e.code}</TableCell>
                    <TableCell className="text-sm">{e.desc}</TableCell>
                    <TableCell className="text-sm">{e.sol}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribución al cliente</CardTitle>
          <CardDescription>Una vez ACEPTADO, el comprobante se puede compartir sin salir de Powip.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {DISTRIBUCION.map((d) => (
              <div key={d.k}>
                <div className="text-muted-foreground text-xs">{d.k}</div>
                <div className="font-medium">{d.v}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
