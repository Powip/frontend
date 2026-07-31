"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";
import { useSunatProfiles } from "@/hooks/sunat/sunat-profile/use-sunat-profiles";
import { useSetDefaultSunatProfile } from "@/hooks/sunat/sunat-profile/use-set-default-sunat-profile";
import { getCertificateStatus } from "@/utils/sunat/certificate-status";

export function CertificadoTab() {
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: profiles = [],
    isLoading,
  } = useSunatProfiles();

  const setDefaultProfile = useSetDefaultSunatProfile();

  const sortedProfiles = [...profiles].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault)
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Certificado Digital</h2>
        <p className="text-sm text-muted-foreground">El certificado P12 firma tus comprobantes antes de enviarlos a SUNAT vía OSE.</p>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-6">
            Cargando certificados...
          </CardContent>
        </Card>
      )}

      {!isLoading && profiles.length === 0 && (
        <Card className="border-2 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-red-600" />

              <div>
                <h4 className="font-bold">
                  Sin certificados configurados
                </h4>

                <p className="text-sm text-muted-foreground">
                  Sube tu certificado P12 para poder emitir comprobantes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedProfiles.map((cert) => {
        const { daysToExpire, status } = getCertificateStatus(cert);

        const Icon =
          status === "ok"
            ? ShieldCheck
            : status === "warn"
              ? AlertTriangle
              : ShieldX;

        return (
          <Card
            key={cert.id}
            className={cn(
              "border-2",
              status === "ok" &&
                "border-green-200 dark:border-green-900",
              status === "warn" &&
                "border-amber-200 dark:border-amber-900",
              status === "bad" &&
                "border-red-200 dark:border-red-900"
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    status === "ok" &&
                      "bg-green-100 text-green-600 dark:bg-green-950",
                    status === "warn" &&
                      "bg-amber-100 text-amber-600 dark:bg-amber-950",
                    status === "bad" &&
                      "bg-red-100 text-red-600 dark:bg-red-950"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1">
                  <h4 className="font-bold">
                    {cert.razonSocial}
                  </h4>

                  <p className="text-xs text-muted-foreground">
                    RUC {cert.ruc} ·{" "}
                    {status === "bad"
                      ? "Vencido"
                      : status === "warn"
                        ? `Por vencer · ${daysToExpire} días`
                        : "Vigente"}
                  </p>

                  {cert.isDefault && (
                    <span className="inline-flex mt-2 text-xs rounded bg-primary/10 px-2 py-1 text-primary font-medium">
                      Certificado activo para emisión
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Vigente desde
                  </div>

                  <div className="font-bold text-sm mt-1">
                    {cert.certificate.validFrom.toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Vigente hasta
                  </div>

                  <div className="font-bold text-sm mt-1">
                    {cert.certificate.validUntil.toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Cifrado
                  </div>

                  <div className="font-bold text-sm mt-1">
                    AES-256 en reposo
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                {cert.isDefault ? (
                  <span className="text-sm font-medium text-primary">
                    Certificado predeterminado
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    disabled={setDefaultProfile.isPending}
                    onClick={() => setDefaultProfile.mutate(cert.id)}
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
        className="bg-primary hover:bg-primary/90 text-white"
        onClick={() => setModalOpen(true)}
      >
        Subir nuevo certificado
      </Button>

      <CertificadoUploadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
