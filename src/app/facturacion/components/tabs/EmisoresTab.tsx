"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExtraRucSlotsCard } from "@/app/facturacion/components/ExtraRucSlotsCard";
import { EstablishmentCodeModal } from "@/app/facturacion/components/modals/EstablishmentCodeModal";
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
import type { ExtraRucPurchase } from "@/features/sunat/extra-ruc/models/extra-ruc";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import { useActivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile";
import { useDeactivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-deactivate-sunat-profile";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { getCertificateStatus } from "@/features/sunat/sunat-profile/utils/get-certificate-status";
import {
  getSunatProfileErrorMessage,
  isRucLimitError,
} from "@/features/sunat/sunat-profile/utils/sunat-profile-error.util";

interface EmisoresTabProps {
  comprobanteRows: TaxDocumentRow[];
  /** Selects this RUC in the bar and opens the given tab. */
  onOpenIssuer: (profileId: string, tab: "comprobantes" | "series") => void;
  /** Abre el flujo de agregar RUC (incluido o de pago). */
  onAddIssuer: () => void;
  /** Un RUC desactivado no tiene cupo libre: abre el flujo para pagar su cupo con sus datos ya cargados. */
  onReactivate: (profile: SunatProfile) => void;
  /** Cupo dado de baja o vencido: abre el pago de ese RUC con sus datos ya cargados. */
  onRepay?: (purchase: ExtraRucPurchase) => void;
}

/**
 * Multi-RUC overview: every SUNAT profile (RUC) of the company with its
 * certificate, series and documents. Profiles are created and their
 * certificates managed from the "Certificado Digital" tab.
 */
export function EmisoresTab({
  comprobanteRows,
  onOpenIssuer,
  onAddIssuer,
  onReactivate,
  onRepay,
}: EmisoresTabProps) {
  const [editingCode, setEditingCode] = useState<SunatProfile | null>(null);
  const { data: profiles = [], isLoading } = useSunatProfiles();
  const setDefaultProfile = useSetDefaultSunatProfile();
  const deactivateProfile = useDeactivateSunatProfile();

  // El RUC que se está activando: si no hay cupo libre (402) se abre el pago de su cupo con sus datos.
  const activatingRef = useRef<SunatProfile | null>(null);
  const activateProfile = useActivateSunatProfile({
    onError: (error) => {
      const profile = activatingRef.current;

      if (profile && isRucLimitError(error)) {
        onReactivate(profile);
        return;
      }

      toast.error(getSunatProfileErrorMessage(error));
    },
  });

  // Activos primero (predeterminado arriba) y después los desactivados, que se pueden volver a activar.
  const ordered = [...profiles].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      Number(b.isDefault) - Number(a.isDefault) ||
      a.razonSocial.localeCompare(b.razonSocial, "es"),
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

        <Button className="gap-2" onClick={onAddIssuer}>
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
                    onEditEstablishmentCode={() => setEditingCode(profile)}
                    onActivate={() => {
                      activatingRef.current = profile;
                      activateProfile.mutate(profile.id);
                    }}
                    onDeactivate={() => deactivateProfile.mutate(profile.id)}
                    isMakingDefault={setDefaultProfile.isPending}
                    isChangingActive={activateProfile.isPending || deactivateProfile.isPending}
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

      <ExtraRucSlotsCard onRepay={onRepay} />

      <EstablishmentCodeModal profile={editingCode} onClose={() => setEditingCode(null)} />
    </div>
  );
}

function EmisorRow(props: {
  profile: SunatProfile;
  rows: TaxDocumentRow[];
  onOpenIssuer: EmisoresTabProps["onOpenIssuer"];
  onMakeDefault: () => void;
  onEditEstablishmentCode: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  isMakingDefault: boolean;
  isChangingActive: boolean;
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
      {/* The name may wrap, and "make default" lives next to the RUC, so the
          actions column always fits on one line. */}
      <TableCell className="min-w-[10rem] whitespace-normal">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
          {profile.razonSocial}
          {profile.isDefault && <Badge variant="secondary">Predeterminado</Badge>}
          {!profile.isActive && <Badge variant="outline">Inactivo</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>RUC {profile.ruc}</span>
          {!profile.isDefault && profile.isActive && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              disabled={props.isMakingDefault}
              onClick={props.onMakeDefault}
            >
              Hacer predeterminado
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={profile.establishmentCode.trim() ? undefined : "text-red-600"}>
            Cód. establecimiento {profile.establishmentCode.trim() || "sin completar"}
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={props.onEditEstablishmentCode}
          >
            Editar código
          </Button>
        </div>
      </TableCell>

      <TableCell className="whitespace-normal">
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
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {profile.isActive ? (
            <>
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
              {!profile.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={props.isChangingActive}
                  onClick={props.onDeactivate}
                >
                  Desactivar
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" disabled={props.isChangingActive} onClick={props.onActivate}>
              Activar
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
