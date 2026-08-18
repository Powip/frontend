"use client";

import { AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import { getCertificateStatus } from "@/features/sunat/sunat-profile/utils/get-certificate-status";
import { cn } from "@/lib/utils";

export function CertificadoTab() {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: profiles = [], isLoading, isError } = useSunatProfiles();

  const setDefaultProfile = useSetDefaultSunatProfile();

  const sortedProfiles = [...profiles].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

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

      {!isLoading &&
        !isError &&
        sortedProfiles.map((profile) => {
          const { daysToExpire, status } = getCertificateStatus(profile);

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

                <div className="mt-6 flex justify-end border-t pt-4">
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
    </div>
  );
}
