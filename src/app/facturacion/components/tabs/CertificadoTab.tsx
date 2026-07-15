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
import { BetaBanner } from "@/app/facturacion/components/BetaBanner";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";
import CertificadoUploadModal from "@/app/facturacion/components/modals/CertificadoUploadModal";

interface CertificadoTabProps {
  mock: ReturnType<typeof useFacturacionMock>;
}

export function CertificadoTab({ mock }: CertificadoTabProps) {
  const { cert, subirCertificado } = mock;
  const [modalOpen, setModalOpen] = useState(false);

  const hasCert = !!cert.razon;
  const estado = !hasCert ? "bad" : cert.diasParaVencer <= 0 ? "bad" : cert.diasParaVencer <= 30 ? "warn" : "ok";
  const Icon = estado === "ok" ? ShieldCheck : estado === "warn" ? AlertTriangle : ShieldX;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Certificado Digital</h2>
        <p className="text-sm text-muted-foreground">El certificado P12 firma tus comprobantes antes de enviarlos a SUNAT vía OSE.</p>
      </div>

      <BetaBanner>
        El certificado que subas aquí es solo una vista previa del flujo de validación; todavía no se conecta al firmado real de SUNAT.
      </BetaBanner>

      <Card
        className={cn(
          "border-2",
          estado === "ok" && "border-green-200 dark:border-green-900",
          estado === "warn" && "border-amber-200 dark:border-amber-900",
          estado === "bad" && "border-red-200 dark:border-red-900"
        )}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                estado === "ok" && "bg-green-100 text-green-600 dark:bg-green-950",
                estado === "warn" && "bg-amber-100 text-amber-600 dark:bg-amber-950",
                estado === "bad" && "bg-red-100 text-red-600 dark:bg-red-950"
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">{hasCert ? cert.razon : "Sin certificado configurado"}</h4>
              <p className="text-xs text-muted-foreground">
                {hasCert ? `RUC ${cert.ruc} · ` : ""}
                {!hasCert
                  ? "Sube tu certificado P12 para poder emitir comprobantes"
                  : cert.diasParaVencer <= 0
                    ? "Vencido"
                    : cert.diasParaVencer <= 30
                      ? `Por vencer · ${cert.diasParaVencer} días`
                      : "Vigente"}
              </p>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setModalOpen(true)}>
              Subir nuevo certificado
            </Button>
          </div>

          {hasCert && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div>
                <div className="text-[11px] text-muted-foreground">Vigente desde</div>
                <div className="font-bold text-sm mt-1">{cert.desde}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Vigente hasta</div>
                <div className="font-bold text-sm mt-1">{cert.hasta}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Cifrado</div>
                <div className="font-bold text-sm mt-1">AES-256 en reposo</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasCert && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificado activo</CardTitle>
            <CardDescription>Cada vez que reemplazas el certificado activo queda un registro aquí.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {cert.razon} · vigencia {cert.desde} — {cert.hasta}
            </div>
          </CardContent>
        </Card>
      )}

      <CertificadoUploadModal isOpen={modalOpen} onClose={() => setModalOpen(false)} subirCertificado={subirCertificado} />
    </div>
  );
}
