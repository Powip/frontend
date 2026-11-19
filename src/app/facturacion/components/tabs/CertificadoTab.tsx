"use client";

import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck, ShieldX, Trash2 } from "lucide-react";
import { useState } from "react";
import CertificadoReplaceModal from "@/app/facturacion/components/modals/CertificadoReplaceModal";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";
import { DeleteSunatProfileDialog } from "@/app/facturacion/components/modals/DeleteSunatProfileDialog";
import GreCredentialsModal from "@/app/facturacion/components/modals/GreCredentialsModal";
import { GreModeBanner } from "@/components/gre/GreModeBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGreSettings } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type { GreProfileSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { getCertificateStatus } from "@/features/sunat/sunat-profile/utils/get-certificate-status";
import { cn } from "@/lib/utils";

export function CertificadoTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [profileToReplace, setProfileToReplace] = useState<SunatProfile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<SunatProfile | null>(null);
  const [greProfile, setGreProfile] = useState<GreProfileSettings | null>(null);

  const { data: profiles = [], isLoading, isError } = useSunatProfiles();
  // FEAT-24 H12 — credenciales GRE (guía de remisión) por RUC.
  const greSettings = useGreSettings(profiles.length > 0);

  const setDefaultProfile = useSetDefaultSunatProfile();

  const sortedProfiles = [...profiles].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  // The backend refuses to delete the default profile while the company has
  // others (409), so the dialog blocks it up front.
  const deleteBlockedByDefault = Boolean(
    profileToDelete?.isDefault && profiles.some((profile) => profile.id !== profileToDelete.id),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Certificado Digital</h2>

        <p className="text-sm text-muted-foreground">
          El certificado P12 firma tus comprobantes antes de enviarlos a SUNAT vía OSE.
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-6">Cargando certificados...</CardContent>
        </Card>
      )}

      {isError && !isLoading && (
        <Card className="border-2 border-red-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-red-600" />

              <div>
                <h4 className="font-bold">No se pudieron cargar los certificados</h4>

                <p className="text-sm text-muted-foreground">
                  Intenta nuevamente en unos momentos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && profiles.length === 0 && (
        <Card className="border-2 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-red-600" />

              <div>
                <h4 className="font-bold">Sin certificados configurados</h4>

                <p className="text-sm text-muted-foreground">
                  Sube tu certificado P12 para poder emitir comprobantes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && profiles.length > 0 ? <GreModeBanner settings={greSettings.data} /> : null}

      {!isLoading &&
        !isError &&
        sortedProfiles.map((profile) => {
          const { daysToExpire, status } = getCertificateStatus(profile);
          const gre = greSettings.data?.profiles.find((item) => item.sunatProfileId === profile.id) ?? null;

          const Icon = status === "ok" ? ShieldCheck : status === "warn" ? AlertTriangle : ShieldX;

          return (
            <Card
              key={profile.id}
              className={cn(
                "border-2",
                status === "ok" && "border-green-200 dark:border-green-900",
                status === "warn" && "border-amber-200 dark:border-amber-900",
                status === "bad" && "border-red-200 dark:border-red-900",
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      status === "ok" && "bg-green-100 text-green-600 dark:bg-green-950",
                      status === "warn" && "bg-amber-100 text-amber-600 dark:bg-amber-950",
                      status === "bad" && "bg-red-100 text-red-600 dark:bg-red-950",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold">{profile.razonSocial}</h4>

                    <p className="text-xs text-muted-foreground">
                      RUC {profile.ruc} ·{" "}
                      {status === "bad"
                        ? "Vencido"
                        : status === "warn"
                          ? `Por vencer · ${daysToExpire} días`
                          : "Vigente"}
                    </p>

                    {profile.isDefault && (
                      <span className="mt-2 inline-flex rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        Certificado activo para emisión
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-6">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Vigente desde</div>

                    <div className="mt-1 text-sm font-bold">
                      {profile.certificateValidFrom
                        ? profile.certificateValidFrom.toLocaleDateString()
                        : "No disponible"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-muted-foreground">Vigente hasta</div>

                    <div className="mt-1 text-sm font-bold">
                      {profile.certificateValidUntil
                        ? profile.certificateValidUntil.toLocaleDateString()
                        : "No disponible"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-muted-foreground">Cifrado</div>

                    <div className="mt-1 text-sm font-bold">AES-256 en reposo</div>
                  </div>
                </div>

                <div
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                  data-testid={`gre-credentials-${profile.ruc}`}
                >
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold">
                        Guía de remisión (GRE):{" "}
                        {greSettings.isPending ? (
                          <span className="font-normal text-muted-foreground">cargando…</span>
                        ) : greSettings.isError ? (
                          <span className="font-normal text-destructive">no se pudo consultar</span>
                        ) : gre?.configured ? (
                          <span className="text-green-700 dark:text-green-400">configurada</span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">falta configurar</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {gre?.configured
                          ? `client_id ${gre.clientId ?? "—"} · serie ${gre.series ?? "T001"} · próximo número ${gre.nextCorrelative ?? 1}`
                          : "Carga el client_id y el client_secret de SOL para emitir guías de remisión con este RUC."}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" disabled={!gre} onClick={() => setGreProfile(gre)}>
                    {gre?.configured ? "Actualizar credenciales GRE" : "Configurar credenciales GRE"}
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setProfileToReplace(profile)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reemplazar certificado
                    </Button>

                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setProfileToDelete(profile)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar certificado
                    </Button>
                  </div>

                  {profile.isDefault ? (
                    <span className="text-sm font-medium text-primary">
                      Certificado predeterminado
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={setDefaultProfile.isPending}
                      onClick={() => setDefaultProfile.mutate(profile.id)}
                    >
                      Usar como predeterminado
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

      <Button
        className="bg-primary text-white hover:bg-primary/90"
        onClick={() => setModalOpen(true)}
      >
        Subir nuevo certificado
      </Button>

      <CertificadoUploadModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      <CertificadoReplaceModal
        profile={profileToReplace}
        onClose={() => setProfileToReplace(null)}
      />

      <GreCredentialsModal profile={greProfile} onClose={() => setGreProfile(null)} />

      <DeleteSunatProfileDialog
        profile={profileToDelete}
        blockedByDefault={deleteBlockedByDefault}
        isOnlyProfile={profiles.length === 1}
        onClose={() => setProfileToDelete(null)}
      />
    </div>
  );
}
