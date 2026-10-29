"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { usePartnerAttributions } from "@/features/partners/hooks/use-partner-attributions";
import { toPartnersRequestError } from "@/features/partners/mappers/to-partners-request-error";
import { hasPartnerPermission } from "@/features/partners/utils/partner-access";
import { getPartnersErrorMessage } from "@/features/partners/utils/partners-error-message";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

function EvidenceDate({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormatter.format(new Date(value))} UTC</time>;
}

export function LinkAttributionsSection() {
  const partner = useCurrentPartner();
  const canRead = hasPartnerPermission(partner, "REFERRALS_READ");
  const query = usePartnerAttributions(canRead);
  const items = query.data?.pages.flatMap((page) => page.items);
  const error = query.isError ? toPartnersRequestError(query.error) : null;
  const errorMessage = error?.code === "ATTRIBUTIONS_UNAVAILABLE"
    ? "Las atribuciones por link no están disponibles actualmente. Tus referidos registrados siguen disponibles."
    : error ? getPartnersErrorMessage(error, "No pudimos cargar las atribuciones por link.") : "";

  return (
    <Card className="rounded-2xl" aria-label="Empresas atribuidas por link">
      <CardHeader>
        <CardTitle>Empresas atribuidas por link</CardTitle>
        <p className="text-sm text-muted-foreground">
          Empresas vinculadas a tu link por el servicio de Partners. Una atribución no acredita pagos ni comisiones.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canRead ? <p>No tenés permiso para consultar atribuciones por link.</p> : (
          <>
            {query.isLoading ? <p role="status">Cargando atribuciones por link...</p> : null}
            {query.isError && !items ? (
              <PartnerSectionError message={errorMessage} onRetry={() => query.refetch()} />
            ) : items?.length === 0 ? (
              <p>Todavía no hay empresas atribuidas a tu link.</p>
            ) : items && items.length > 0 ? (
              <Table aria-label="Atribuciones LINK">
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa (ID)</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead>
                    <TableHead>Empresa creada</TableHead><TableHead>Atribuida</TableHead><TableHead>Evidencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.companyId}</TableCell>
                      <TableCell>{item.source}</TableCell><TableCell>Confirmada</TableCell>
                      <TableCell><EvidenceDate value={item.companyCreatedAt} /></TableCell>
                      <TableCell><EvidenceDate value={item.confirmedAt} /></TableCell>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer">Ver evidencia</summary>
                          <dl className="mt-2 space-y-1 text-xs">
                            <dt>Captura</dt><dd><EvidenceDate value={item.capturedAt} /></dd>
                            <dt>Vigencia de captura</dt><dd><EvidenceDate value={item.expiresAt} /></dd>
                            <dt>Motivo</dt><dd>Primera captura válida</dd>
                          </dl>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {query.isError && items ? <p role="alert">{errorMessage}</p> : null}
            {query.hasNextPage ? (
              <Button type="button" variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Cargando atribuciones..." : "Cargar más atribuciones"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
