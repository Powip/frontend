"use client";

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
import { useCreateSunatProfile } from "@/hooks/sunat/sunat-profile/use-create-sunat-profile";
import { useForm } from "react-hook-form";
import { CreateSunatProfileInput, createSunatProfileSchema } from "@/schemas/sunat/create-sunat-profile.schema";
import { zodResolver } from "@hookform/resolvers/zod";

interface CertificadoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CertificadoUploadModal({
  isOpen,
  onClose,
}: CertificadoUploadModalProps) {
  const form = useForm<CreateSunatProfileInput>({
    resolver: zodResolver(createSunatProfileSchema),
    defaultValues: {
      razonSocial: "",
      description: "",
      ruc: "",
      ubigeo: "",
      address: "",
      usuarioSol: "",
      claveSol: "",
      claveCertificado: "",
      certificado: undefined,
    },
  });

  const createSunatProfile = useCreateSunatProfile();

  const handleSubmit = (
    values: CreateSunatProfileInput
  ) => {
    createSunatProfile.mutate(
      {
        razonSocial: values.razonSocial.trim(),
        ruc: values.ruc.trim(),
        ubigeo: values.ubigeo.trim(),
        address: values.address.trim(),
        description: values.description?.trim(),
        usuarioSol: values.usuarioSol.trim(),
        claveSol: values.claveSol.trim(),
        claveCertificado: values.claveCertificado.trim(),
        certificado: values.certificado,
      },
      {
        onSuccess: () => {
          form.reset();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Subir Certificado Digital
            </DialogTitle>

            <DialogDescription>
              El certificado P12 se cifra antes de guardarse. Nunca se almacena en texto plano.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Razón Social</Label>

                <Input
                  {...form.register("razonSocial")}
                  placeholder="Ej. Mi Empresa S.A.C."
                />

                {form.formState.errors.razonSocial && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.razonSocial.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>RUC</Label>

                <Input
                  {...form.register("ruc")}
                  placeholder="20xxxxxxxxx"
                />

                {form.formState.errors.ruc && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.ruc.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Ubigeo</Label>

              <Input
                {...form.register("ubigeo")}
                placeholder="Ej. 150101"
              />

              {form.formState.errors.ubigeo && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.ubigeo.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Dirección</Label>

              <Input
                {...form.register("address")}
                placeholder="Av. Principal 123"
              />

              {form.formState.errors.address && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Archivo del certificado (.p12)</Label>

              <Input
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    form.setValue("certificado", file, {
                      shouldValidate: true,
                    });
                  }
                }}
              />

              {form.formState.errors.certificado && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.certificado.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Contraseña del certificado</Label>

              <Input
                type="password"
                {...form.register("claveCertificado")}
                placeholder="Contraseña asignada por tu entidad certificadora"
              />

              {form.formState.errors.claveCertificado && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.claveCertificado.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Usuario SOL</Label>

              <Input
                {...form.register("usuarioSol")}
              />

              {form.formState.errors.usuarioSol && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.usuarioSol.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Clave SOL</Label>

              <Input
                type="password"
                {...form.register("claveSol")}
              />

              {form.formState.errors.claveSol && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.claveSol.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={createSunatProfile.isPending}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={createSunatProfile.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {createSunatProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                "Validar y guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
