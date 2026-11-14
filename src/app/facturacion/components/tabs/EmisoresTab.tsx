"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { getCertificateStatus } from "@/features/sunat/sunat-profile/utils/get-certificate-status";

interface EmisoresTabProps {
  comprobanteRows: TaxDocumentRow[];
  /** Selects this RUC in the bar and opens the given tab. */
  onOpenIssuer: (profileId: string, tab: "comprobantes" | "series") => void;
}

/**
 * Multi-RUC overview: every SUNAT profile (RUC) of the company with its
 * certificate, series and documents. Profiles are created and their
 * certificates managed from the "Certificado Digital" tab.
 */
export function EmisoresTab({ comprobanteRows, onOpenIssuer }: EmisoresTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: profiles = [], isLoading } = useSunatProfiles();
  const setDefaultProfile = useSetDefaultSunatProfile();

  const ordered = [...profiles].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) || a.razonSocial.localeCompare(b.razonSocial, "es"),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-lg font-bold">Emisores (RUC)</h2>
          <p className="text-sm text-muted-foreground">
            Conecta uno o más RUC. Cada RUC tiene su propio certificado digital, credenciales SOL y
            series. Al emitir eliges con qué RUC sale cada comprobante.
          </p>
        </div>

        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar RUC
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">RUC conectados</CardTitle>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razón social / RUC</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead className="text-center">Series</TableHead>
                <TableHead className="text-center">Emitidos</TableHead>
                <TableHead className="text-center">Rechazados</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Cargando emisores...
                  </TableCell>
                </TableRow>
              ) : ordered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Aún no conectaste ningún RUC. Agrega uno con su certificado digital para emitir.
                  </TableCell>
                </TableRow>
              ) : (
                ordered.map((profile) => (
                  <EmisorRow
                    key={profile.id}
                    profile={profile}
                    rows={comprobanteRows.filter(
                      (row) => row.taxDocument?.rucIssuer === profile.ruc,
                    )}
                    onOpenIssuer={onOpenIssuer}
                    onMakeDefault={() => setDefaultProfile.mutate(profile.id)}
                    isMakingDefault={setDefaultProfile.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Los comprobantes ya emitidos conservan su RUC original. Toda nota de crédito o débito se
        emite con el RUC del comprobante que corrige.
      </div>

      <CertificadoUploadModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function EmisorRow(props: {
  profile: SunatProfile;
  rows: TaxDocumentRow[];
  onOpenIssuer: EmisoresTabProps["onOpenIssuer"];
  onMakeDefault: () => void;
  isMakingDefault: boolean;
}) {
  const { profile, rows } = props;
  const { data: sequences = [] } = useSunatDocumentSequences(profile.id, {
    enabled: profile.isActive,
  });
  const certificate = getCertificateStatus(profile);
  const rejected = rows.filter((row) => row.taxDocument?.cdrStatus === "REJECTED").length;

  const certificateLabel =
    certificate.status === "bad"
      ? "Vencido"
      : certificate.status === "warn"
        ? `Vence en ${certificate.daysToExpire} días`
        : certificate.status === "ok"
          ? `Vigente hasta ${profile.certificateValidUntil?.toLocaleDateString("es-PE")}`
          : "Sin datos";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 font-semibold">
          {profile.razonSocial}
          {profile.isDefault && <Badge variant="secondary">Predeterminado</Badge>}
          {!profile.isActive && <Badge variant="outline">Inactivo</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">RUC {profile.ruc}</div>
      </TableCell>

      <TableCell>
        <span
          className={
            certificate.status === "bad"
              ? "font-medium text-red-600"
              : certificate.status === "warn"
                ? "font-medium text-amber-600"
                : "text-sm"
          }
        >
          {certificateLabel}
        </span>
      </TableCell>

      <TableCell className="text-center">{sequences.length}</TableCell>
      <TableCell className="text-center">{rows.length}</TableCell>
      <TableCell className={rejected > 0 ? "text-center font-bold text-red-600" : "text-center"}>
        {rejected}
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpenIssuer(profile.id, "comprobantes")}
          >
            Comprobantes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpenIssuer(profile.id, "series")}
          >
            Series
          </Button>
          {!profile.isDefault && profile.isActive && (
            <Button
              size="sm"
              variant="ghost"
              disabled={props.isMakingDefault}
              onClick={props.onMakeDefault}
            >
              Hacer predeterminado
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
