"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";

interface CertificadoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subirCertificado: ReturnType<typeof useFacturacionMock>["subirCertificado"];
}

export default function CertificadoUploadModal({ isOpen, onClose, subirCertificado }: CertificadoUploadModalProps) {
  const [razon, setRazon] = useState("");
  const [ruc, setRuc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!razon.trim() || !/^(10|20)\d{9}$/.test(ruc.trim())) {
      toast.error("Ingresa la razón social y un RUC válido (11 dígitos)");
      return;
    }
    if (!file || !password) {
      toast.error("Selecciona el archivo .p12 e ingresa la contraseña");
      return;
    }
    setLoading(true);
    await subirCertificado(razon.trim(), ruc.trim());
    setLoading(false);
    toast.success("Certificado guardado (vista previa — aún no conectado a SUNAT).");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Subir Certificado Digital
          </DialogTitle>
          <DialogDescription>
            El certificado P12 se cifra antes de guardarse. Nunca se almacena en texto plano.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Razón Social</Label>
              <Input value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="Ej. Mi Empresa S.A.C." />
            </div>
            <div className="grid gap-2">
              <Label>RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="20xxxxxxxxx" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Archivo del certificado (.p12)</Label>
            <Input type="file" accept=".p12,.pfx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="grid gap-2">
            <Label>Contraseña del certificado</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña asignada por tu entidad certificadora" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90 text-white">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando...
              </>
            ) : (
              "Validar y guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
